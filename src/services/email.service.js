const { Resend } = require('resend');
const config = require('../config/config');
// const resendConfig = require('../config/resend');
const logger = require('../config/logger');

const resendConfig = {
  apiKey: config.resend.apiKey || null,
  from: config.resend.from || 'noreply@twoo.ng',
  frontendUrl: config.resend.frontendUrl || 'http://localhost:5173',
};

let resend = null;
const mockEmails = new Map(); // in-memory store for mock emails

// Initialize Resend if API key is available
if (resendConfig.apiKey) {
  try {
    resend = new Resend(resendConfig.apiKey);
    logger.info('Resend email service initialized');
  } catch (error) {
    logger.warn('Resend not installed. Using mock email service.');
  }
} else {
  logger.warn('RESEND_API_KEY not configured. Using mock email service.');
}

/**
 * Resend provider functions
 */
const sendResendEmail = async (to, subject, text, html = null) => {
  const emailData = {
    from: resendConfig.from,
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
  };

  if (html) {
    emailData.html = html;
  }

  const result = await resend.emails.send(emailData);
  return {
    id: (result.data && result.data.id) || result.id,
    provider: 'resend',
    to,
    subject,
    status: 'sent',
  };
};

/**
 * Mock email functions (for development/testing)
 */
const generateMockId = () => `mock_email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const sendMockEmail = async (to, subject, text, html = null) => {
  const id = generateMockId();
  const email = {
    id,
    from: resendConfig.from || 'noreply@yourdomain.com',
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    html,
    status: 'sent',
    provider: 'mock',
    sentAt: new Date(),
  };

  mockEmails.set(id, email);
  logger.info(`Mock email sent: ${subject} to ${to}`);
  return email;
};

/**
 * Main email sending function - delegates to appropriate provider
 * @param {string|Array} to - recipient email(s)
 * @param {string} subject - email subject
 * @param {string} text - plain text content
 * @param {string} [html] - HTML content (optional)
 * @returns {Promise}
 */
const sendEmail = async (to, subject, text, html = null) => {
  if (resend) {
    return sendResendEmail(to, subject, text, html);
  }
  return sendMockEmail(to, subject, text, html);
};

/**
 * Send reset password email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendPasswordResetEmail = async (to, token) => {
  const subject = 'Reset Your Password - Twoo Bakery Manager 🍞';

  const html = `
  <div style="font-family: 'Segoe UI', sans-serif; background-color: #fffaf2; padding: 30px; border-radius: 12px; color: #4a3b2a;">
    <div style="text-align: center;">
      <img src="https://yourcdn.com/twoo-bakery-logo.png" alt="Twoo Bakery Manager" style="width: 120px; margin-bottom: 20px;" />
      <h2 style="margin: 0; color: #d17a22;">Need to Reset Your Password?</h2>
      <p style="margin-top: 10px; font-size: 16px;">No worries — it happens to the best of bakers 🧁</p>
    </div>

    <div style="margin-top: 25px; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 8px rgba(0,0,0,0.05);">
      <p>Dear Baker,</p>
      <p>
        We received a request to reset your Twoo Bakery Manager password.  
        Use the code below to create a new one:
      </p>

      <div style="text-align: center; margin: 25px 0;">
        <div style="display: inline-block; background-color: #d17a22; color: #fff; font-size: 22px; letter-spacing: 3px; padding: 12px 24px; border-radius: 8px;">
          ${token}
        </div>
      </div>

      <p>This code will expire in <strong>10 minutes</strong>.</p>

      <p>
        Didn’t request this password reset? Don’t worry — just ignore this email,  
        and your current password will stay the same.
      </p>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 14px; color: #8c6e50;">
      <p>Keep baking great things,</p>
      <p><strong>The Twoo Bakery Manager Team 🥐</strong></p>
      <p style="font-size: 12px; color: #b8a68a;">© ${new Date().getFullYear()} Twoo. All rights reserved.</p>
    </div>
  </div>
  `;

  const text = `
  Reset Your Password - Twoo Bakery Manager

  We received a request to reset your password.
  Use the following code to set a new one:

  ${token}

  This code will expire in 10 minutes.
  If you didn’t request this, simply ignore this email.

  — The Twoo Bakery Manager Team 🥐
  `;

  await sendEmail(to, subject, text, html);
};

/**
 * Send reset password email for mobile app
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendResetPasswordEmailForMobile = async (to, token) => {
  const subject = 'Reset Your Password - RichList Auth';
  const text = `Dear user,

To reset your password, use the following code: ${token}

This code will expire in 10 minutes for security reasons.

If you did not request a password reset, please ignore this email or contact support if you have concerns.

Best regards,
The RichList Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Reset Your Password</h2>
      <p>Dear user,</p>
      <p>To reset your password, use the code below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <h3 style="color: #007bff;">${token}</h3>
      </div>
      <p><strong>This code will expire in 10 minutes for security reasons.</strong></p>
      <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">Best regards,<br>The RichList Team</p>
    </div>
  `;

  return sendEmail(to, subject, text, html);
};

/**
 * Send one time password for mobile app
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendOneTimePasswordForMobile = async (to, token) => {
  const subject = 'Your One Time Password - RichList Auth';
  const text = `Dear user,

Your one time password (OTP) is: ${token}

This OTP will expire in 10 minutes for security reasons.

If you did not request this OTP, please ignore this email or contact support if you have concerns.

Best regards,
The RichList Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Your One Time Password</h2>
      <p>Dear user,</p>
      <p>Your one time password (OTP) is:</p>
      <div style="text-align: center; margin: 30px 0;">
        <h3 style="color: #007bff;">${token}</h3>
      </div>
      <p><strong>This OTP will expire in 10 minutes for security reasons.</strong></p>
      <p>If you did not request this OTP, please ignore this email or contact support if you have concerns.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">Best regards,<br>The RichList Team</p>
    </div>
  `;

  return sendEmail(to, subject, text, html);
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendVerificationEmail = async (to, token) => {
  const subject = 'Welcome to Twoo Bakery Manager 🍰';

  const html = `
  <div style="font-family: 'Segoe UI', sans-serif; background-color: #fffaf2; padding: 30px; border-radius: 12px; color: #4a3b2a;">
    <div style="text-align: center;">
      <img src="https://yourcdn.com/twoo-bakery-logo.png" alt="Twoo Bakery Manager" style="width: 120px; margin-bottom: 20px;" />
      <h2 style="margin: 0; color: #d17a22;">Welcome to Twoo Bakery Manager!</h2>
      <p style="margin-top: 10px; font-size: 16px;">We’re thrilled to have you on board 🍩</p>
    </div>

    <div style="margin-top: 25px; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 8px rgba(0,0,0,0.05);">
      <p>Dear Baker,</p>
      <p>
        Your bakery management journey starts here!  
        To keep your account secure, please verify your email address using the code below:
      </p>

      <div style="text-align: center; margin: 25px 0;">
        <div style="display: inline-block; background-color: #d17a22; color: #fff; font-size: 22px; letter-spacing: 3px; padding: 12px 24px; border-radius: 8px;">
          ${token}
        </div>
      </div>

      <p>This code will expire in <strong>10 minutes</strong>.</p>

      <p>
        If you didn’t create an account with Twoo Bakery Manager, please ignore this email.
      </p>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 14px; color: #8c6e50;">
      <p>Warm regards,</p>
      <p><strong>The Twoo Bakery Manager Team 🥐</strong></p>
      <p style="font-size: 12px; color: #b8a68a;">© ${new Date().getFullYear()} Twoo. All rights reserved.</p>
    </div>
  </div>
  `;

  const text = `
  Welcome to Twoo Bakery Manager!

  We’re thrilled to have you on board 🍩
  To verify your account, use the following code:

  ${token}

  This code will expire in 10 minutes.
  If you didn’t create this account, please ignore this email.

  — The Twoo Bakery Manager Team
  `;

  await sendEmail(to, subject, text, html);
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendVerificationEmailForMobile = async (to, token) => {
  const subject = 'Verify Your Email - RichList Auth';

  const text = `Dear user,

Welcome to RichList!

To verify your email address, use the following code: ${token}

This code will expire in 10 minutes for security reasons.

If you did not create an account, please ignore this email.

Best regards,
The RichList Team`;

  const html = `
  <div style="font-family: 'Poppins', Arial, sans-serif; background-color: #0B0B0B; color: #FFFFFF; max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 0 20px rgba(212, 175, 55, 0.15);">
    <div style="background: linear-gradient(135deg, #000000 0%, #1A1A1A 100%); padding: 30px 25px; text-align: center;">
      <h1 style="color: #D4AF37; margin-bottom: 10px;">RichList</h1>
      <p style="color: #BFBFBF; font-size: 14px; margin: 0;">Exclusive Access Starts Here</p>
    </div>

    <div style="padding: 30px 25px;">
      <p style="font-size: 16px; color: #FFFFFF;">Dear user,</p>
      <p style="font-size: 15px; color: #BFBFBF;">Welcome to <strong style="color: #D4AF37;">RichList</strong>! To verify your email address, use the verification code below:</p>

      <div style="text-align: center; background: #111; border: 1px solid #D4AF37; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h2 style="color: #D4AF37; letter-spacing: 2px;">${token}</h2>
      </div>

      <p style="font-size: 14px; color: #BFBFBF;">This code will expire in <strong style="color: #D4AF37;">10 minutes</strong> for security reasons.</p>
      <p style="font-size: 14px; color: #BFBFBF;">If you did not create an account, please ignore this email.</p>
    </div>

    <div style="background-color: #0B0B0B; border-top: 1px solid #222; text-align: center; padding: 20px;">
      <p style="color: #555; font-size: 12px; margin: 0;">Best regards,<br><span style="color: #D4AF37;">The RichList Team</span></p>
      <p style="font-size: 11px; color: #444; margin-top: 10px;">© ${new Date().getFullYear()} RichList. All Rights Reserved.</p>
    </div>
  </div>
  `;

  return sendEmail(to, subject, text, html);
};

/**
 * Send welcome email after successful verification
 * @param {string} to
 * @param {string} name
 * @returns {Promise}
 */
const sendWelcomeEmail = async (to, name = 'user') => {
  const subject = 'Welcome to RichList! 🎉';

  const text = `Dear ${name},

Welcome to RichList! Your email has been successfully verified.

You can now access all features of our platform. Here's what you can do:
- Explore shows and events
- Make bookings
- Manage your subscriptions
- And much more!

If you have any questions or need assistance, feel free to contact our support team.

Best regards,
The RichList Team`;

  const html = `
  <div style="font-family: 'Poppins', Arial, sans-serif; background-color: #0B0B0B; color: #FFFFFF; max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 0 20px rgba(212, 175, 55, 0.15);">
    <div style="background: linear-gradient(135deg, #000000 0%, #1A1A1A 100%); padding: 30px 25px; text-align: center;">
      <h1 style="color: #D4AF37; margin-bottom: 10px;">Welcome to RichList 🎉</h1>
      <p style="color: #BFBFBF; font-size: 14px; margin: 0;">Lagos’ Most Exclusive Nightlife Network</p>
    </div>

    <div style="padding: 30px 25px;">
      <p style="font-size: 16px; color: #FFFFFF;">Dear ${name},</p>
      <p style="font-size: 15px; color: #BFBFBF;">Your email has been successfully verified. You’re now officially part of the <strong style="color: #D4AF37;">RichList</strong> community.</p>

      <p style="margin-top: 20px; font-size: 15px; color: #FFFFFF;">Here’s what you can do:</p>
      <ul style="color: #BFBFBF; padding-left: 20px; line-height: 1.8;">
        <li>🔥 Explore trending shows & events in Lagos</li>
        <li>🍾 Reserve VIP tables and premium spots</li>
        <li>💳 Manage your bookings & subscriptions</li>
        <li>💫 Unlock exclusive member rewards</li>
      </ul>

      <p style="font-size: 14px; color: #BFBFBF; margin-top: 25px;">Need help? Reach out to our support team anytime.</p>

      <div style="text-align: center; margin-top: 30px;">
        <a href="https://richlist.ng" style="background-color: #D4AF37; color: #0B0B0B; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Explore Now</a>
      </div>
    </div>

    <div style="background-color: #0B0B0B; border-top: 1px solid #222; text-align: center; padding: 20px;">
      <p style="color: #555; font-size: 12px; margin: 0;">Best regards,<br><span style="color: #D4AF37;">The RichList Team</span></p>
      <p style="font-size: 11px; color: #444; margin-top: 10px;">© ${new Date().getFullYear()} RichList. All Rights Reserved.</p>
    </div>
  </div>
  `;

  return sendEmail(to, subject, text, html);
};

/** Send new order notification email
 * @param {string} to
 * @param {Object} order
 * @returns {Promise}
 */

const sendNewOrderNotificationEmail = async (to, order) => {
  const subject = `New Order Received! 🍞 Order #${order.orderId}`;

  const html = `
  <div style="font-family: 'Segoe UI', sans-serif; background-color: #fffaf2; padding: 30px; border-radius: 12px; color: #4a3b2a;">
    <div style="text-align: center;">
      <img src="https://yourcdn.com/twoo-bakery-logo.png" alt="Twoo Bakery Manager" style="width: 120px; margin-bottom: 20px;" />
      <h2 style="margin: 0; color: #d17a22;">You've Got a Fresh Order! 🥐</h2>
      <p style="margin-top: 10px; font-size: 16px;">A customer just placed a new order through Twoo Bakery Manager.</p>
    </div>

    <div style="margin-top: 25px; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 8px rgba(0,0,0,0.05);">
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Customer:</strong> ${order.customerName}</p>
      <p><strong>Items Ordered:</strong></p>
      <ul style="padding-left: 20px;">
        ${order.items
          .map(
            (item) => `
          <li>${item.quantity} × ${item.name} (${item.price.toFixed(2)} ${order.currency})</li>
        `
          )
          .join('')}
      </ul>
      <p><strong>Total:</strong> ${order.total.toFixed(2)} ${order.currency}</p>
      <p><strong>Pickup/Delivery:</strong> ${order.type}</p>
      <p><strong>Expected Time:</strong> ${order.expectedTime}</p>
    </div>

    <div style="text-align: center; margin-top: 25px;">
      <a href="https://manager.twoo.com/orders/${order.orderId}" 
         style="background-color: #d17a22; color: #fff; text-decoration: none; font-weight: bold; 
                padding: 12px 28px; border-radius: 8px; display: inline-block;">
        View Order Details
      </a>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 14px; color: #8c6e50;">
      <p>Keep your ovens warm 🔥 and your customers happy!</p>
      <p><strong>The Twoo Bakery Manager Team 🍪</strong></p>
      <p style="font-size: 12px; color: #b8a68a;">© ${new Date().getFullYear()} Twoo. All rights reserved.</p>
    </div>
  </div>
  `;

  const text = `
  You've Got a Fresh Order! 🥐

  Order ID: ${order.orderId}
  Customer: ${order.customerName}

  Items:
  ${order.items.map((item) => `${item.quantity} × ${item.name} (${item.price.toFixed(2)} ${order.currency})`).join('\n')}

  Total: ${order.total.toFixed(2)} ${order.currency}
  Type: ${order.type}
  Expected Time: ${order.expectedTime}

  View details: https://manager.twoo.com/orders/${order.orderId}

  Keep your ovens warm 🔥
  — The Twoo Bakery Manager Team
  `;

  await sendEmail(to, subject, text, html);
};

/** Send daily sales summary email
 * @param {string} to
 * @param {Object} summary
 * @returns {Promise}
 */

const sendDailySalesSummaryEmail = async (to, summary) => {
  const subject = `Your Daily Sales Summary 🍰 - ${summary.date}`;

  const html = `
  <div style="font-family: 'Segoe UI', sans-serif; background-color: #fffaf2; padding: 30px; border-radius: 12px; color: #4a3b2a;">
    <div style="text-align: center;">
      <img src="https://yourcdn.com/twoo-bakery-logo.png" alt="Twoo Bakery Manager" style="width: 120px; margin-bottom: 20px;" />
      <h2 style="margin: 0; color: #d17a22;">Your Daily Sales Summary 🥐</h2>
      <p style="margin-top: 10px; font-size: 16px;">Here’s how your bakery performed today — ${summary.date}</p>
    </div>

    <div style="margin-top: 25px; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 8px rgba(0,0,0,0.05);">
      <h3 style="color: #d17a22; margin-bottom: 10px;">📊 Overview</h3>
      <p><strong>Total Orders:</strong> ${summary.totalOrders}</p>
      <p><strong>Total Sales:</strong> ${summary.totalSales.toFixed(2)} ${summary.currency}</p>
      <p><strong>Average Order Value:</strong> ${summary.averageOrderValue.toFixed(2)} ${summary.currency}</p>

      <hr style="border: none; border-top: 1px solid #f0e6d5; margin: 20px 0;" />

      <h3 style="color: #d17a22; margin-bottom: 10px;">🥖 Top Selling Items</h3>
      <ul style="padding-left: 20px; margin: 0;">
        ${
          summary.topItems.length > 0
            ? summary.topItems
                .map(
                  (item) => `
          <li>${item.name} — ${item.quantitySold} sold (${item.totalSales.toFixed(2)} ${summary.currency})</li>
        `
                )
                .join('')
            : '<li>No sales recorded today.</li>'
        }
      </ul>

      ${
        summary.lowStockItems?.length > 0
          ? `
        <hr style="border: none; border-top: 1px solid #f0e6d5; margin: 20px 0;" />
        <h3 style="color: #d17a22; margin-bottom: 10px;">⚠️ Low Stock Alerts</h3>
        <ul style="padding-left: 20px; margin: 0;">
          ${summary.lowStockItems
            .map(
              (item) => `
            <li>${item.name} — Only ${item.remaining} left</li>
          `
            )
            .join('')}
        </ul>
      `
          : ''
      }
    </div>

    <div style="text-align: center; margin-top: 25px;">
      <a href="https://manager.twoo.com/dashboard" 
         style="background-color: #d17a22; color: #fff; text-decoration: none; font-weight: bold; 
                padding: 12px 28px; border-radius: 8px; display: inline-block;">
        View Full Dashboard
      </a>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 14px; color: #8c6e50;">
      <p>Keep baking, keep growing 💪</p>
      <p><strong>The Twoo Bakery Manager Team 🍪</strong></p>
      <p style="font-size: 12px; color: #b8a68a;">© ${new Date().getFullYear()} Twoo. All rights reserved.</p>
    </div>
  </div>
  `;

  const text = `
  Your Daily Sales Summary - ${summary.date}

  Total Orders: ${summary.totalOrders}
  Total Sales: ${summary.totalSales.toFixed(2)} ${summary.currency}
  Average Order Value: ${summary.averageOrderValue.toFixed(2)} ${summary.currency}

  Top Selling Items:
  ${
    summary.topItems.length > 0
      ? summary.topItems
          .map((item) => `${item.name} — ${item.quantitySold} sold (${item.totalSales.toFixed(2)} ${summary.currency})`)
          .join('\n')
      : 'No sales recorded today.'
  }

  ${
    summary.lowStockItems?.length > 0
      ? `
  Low Stock Alerts:
  ${summary.lowStockItems.map((item) => `${item.name} — Only ${item.remaining} left`).join('\n')}
  `
      : ''
  }

  View dashboard: https://manager.twoo.com/dashboard

  Keep baking, keep growing 💪
  — The Twoo Bakery Manager Team
  `;

  await sendEmail(to, subject, text, html);
};

/** Send subscription confirmation email
 * @param {string} to
 * @param {Object} details
 * @returns {Promise}
 */

const sendSubscriptionConfirmationEmail = async (to, details) => {
  const subject = `Subscription Confirmed 🎉 - Twoo Bakery Manager`;

  const html = `
  <div style="font-family: 'Segoe UI', sans-serif; background-color: #fffaf2; padding: 30px; border-radius: 12px; color: #4a3b2a;">
    <div style="text-align: center;">
      <img src="https://yourcdn.com/twoo-bakery-logo.png" alt="Twoo Bakery Manager" style="width: 120px; margin-bottom: 20px;" />
      <h2 style="margin: 0; color: #d17a22;">Subscription Confirmed 🎉</h2>
      <p style="margin-top: 10px; font-size: 16px;">Your Twoo Bakery Manager plan is now active!</p>
    </div>

    <div style="margin-top: 25px; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 8px rgba(0,0,0,0.05);">
      <p>Dear ${details.bakeryName || 'Baker'},</p>
      <p>
        Thank you for your payment! Your bakery’s subscription has been successfully
        <strong>${details.action || 'activated'}</strong>.
      </p>

      <h3 style="color: #d17a22; margin-top: 20px;">🧾 Subscription Details</h3>
      <p><strong>Plan:</strong> ${details.planName}</p>
      <p><strong>Amount Paid:</strong> ${details.amount.toFixed(2)} ${details.currency}</p>
      <p><strong>Payment Date:</strong> ${details.date}</p>
      <p><strong>Valid Until:</strong> ${details.validUntil}</p>

      <hr style="border: none; border-top: 1px solid #f0e6d5; margin: 20px 0;" />

      <p>
        You can view your payment history or manage your plan anytime from your dashboard.
      </p>
    </div>

    <div style="text-align: center; margin-top: 25px;">
      <a href="https://manager.twoo.com/billing" 
         style="background-color: #d17a22; color: #fff; text-decoration: none; font-weight: bold; 
                padding: 12px 28px; border-radius: 8px; display: inline-block;">
        Manage Subscription
      </a>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 14px; color: #8c6e50;">
      <p>Thanks for trusting Twoo Bakery Manager to help your bakery grow 🌾</p>
      <p><strong>The Twoo Bakery Manager Team 🍪</strong></p>
      <p style="font-size: 12px; color: #b8a68a;">© ${new Date().getFullYear()} Twoo. All rights reserved.</p>
    </div>
  </div>
  `;

  const text = `
  Subscription Confirmed 🎉 - Twoo Bakery Manager

  Dear ${details.bakeryName || 'Baker'},

  Your Twoo Bakery Manager plan has been successfully ${details.action || 'activated'}.

  Plan: ${details.planName}
  Amount Paid: ${details.amount.toFixed(2)} ${details.currency}
  Payment Date: ${details.date}
  Valid Until: ${details.validUntil}

  You can manage your subscription anytime from your dashboard:
  https://manager.twoo.com/billing

  Thanks for trusting Twoo Bakery Manager to help your bakery grow 🌾
  — The Twoo Bakery Manager Team
  `;

  await sendEmail(to, subject, text, html);
};

/** Send new order notification email to bakery owner
 * @param {string} to
 * @param {Object} order
 * @returns {Promise}
 */

const sendOwnerNewOrderNotificationEmail = async (to, order) => {
  const subject = `🥖 New Order Received! - Order #${order.orderId}`;

  const html = `
  <div style="font-family: 'Segoe UI', sans-serif; background-color: #fffaf2; padding: 30px; border-radius: 12px; color: #4a3b2a;">
    <div style="text-align: center;">
      <img src="https://yourcdn.com/twoo-bakery-logo.png" alt="Twoo Bakery Manager" style="width: 120px; margin-bottom: 20px;" />
      <h2 style="margin: 0; color: #d17a22;">New Order for ${order.bakeryName || 'Your Bakery'} 🧁</h2>
      <p style="margin-top: 10px; font-size: 16px;">A customer just placed a new order through Twoo Bakery Manager!</p>
    </div>

    <div style="margin-top: 25px; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 8px rgba(0,0,0,0.05);">
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Customer Name:</strong> ${order.customerName}</p>
      <p><strong>Contact:</strong> ${order.customerPhone || 'N/A'}</p>
      <p><strong>Order Type:</strong> ${order.type}</p>
      <p><strong>Order Time:</strong> ${order.orderTime}</p>

      <hr style="border: none; border-top: 1px solid #f0e6d5; margin: 20px 0;" />

      <h3 style="color: #d17a22; margin-bottom: 10px;">🧾 Order Details</h3>
      <ul style="padding-left: 20px;">
        ${order.items
          .map(
            (item) => `
          <li>${item.quantity} × ${item.name} (${item.price.toFixed(2)} ${order.currency})</li>
        `
          )
          .join('')}
      </ul>

      <p style="margin-top: 15px;"><strong>Total Amount:</strong> ${order.total.toFixed(2)} ${order.currency}</p>
      ${order.notes ? `<p><strong>Customer Note:</strong> ${order.notes}</p>` : ''}
    </div>

    <div style="text-align: center; margin-top: 25px;">
      <a href="https://manager.twoo.com/orders/${order.orderId}" 
         style="background-color: #d17a22; color: #fff; text-decoration: none; font-weight: bold; 
                padding: 12px 28px; border-radius: 8px; display: inline-block;">
        View Order in Dashboard
      </a>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 14px; color: #8c6e50;">
      <p>Keep your ovens warm 🔥 and your customers happy!</p>
      <p><strong>The Twoo Bakery Manager Team 🍪</strong></p>
      <p style="font-size: 12px; color: #b8a68a;">© ${new Date().getFullYear()} Twoo. All rights reserved.</p>
    </div>
  </div>
  `;

  const text = `
  New Order for ${order.bakeryName || 'Your Bakery'} 🧁

  Order ID: ${order.orderId}
  Customer: ${order.customerName}
  Contact: ${order.customerPhone || 'N/A'}
  Order Type: ${order.type}
  Order Time: ${order.orderTime}

  Items:
  ${order.items.map((item) => `${item.quantity} × ${item.name} (${item.price.toFixed(2)} ${order.currency})`).join('\n')}

  Total: ${order.total.toFixed(2)} ${order.currency}
  ${order.notes ? `Customer Note: ${order.notes}` : ''}

  View in Dashboard: https://manager.twoo.com/orders/${order.orderId}

  Keep your ovens warm 🔥 and your customers happy!
  — The Twoo Bakery Manager Team
  `;

  await sendEmail(to, subject, text, html);
};

/** Send low stock alert email
 * @param {string} to
 * @param {Object} details
 * @returns {Promise}
 */

const sendLowStockAlertEmail = async (to, details) => {
  const subject = `⚠️ Low Stock Alert - ${details.bakeryName || 'Your Bakery'}`;

  const html = `
  <div style="font-family: 'Segoe UI', sans-serif; background-color: #fffaf2; padding: 30px; border-radius: 12px; color: #4a3b2a;">
    <div style="text-align: center;">
      <img src="https://yourcdn.com/twoo-bakery-logo.png" alt="Twoo Bakery Manager" style="width: 120px; margin-bottom: 20px;" />
      <h2 style="margin: 0; color: #d17a22;">Low Stock Alert ⚠️</h2>
      <p style="margin-top: 10px; font-size: 16px;">Some of your bakery items are running low — time to restock!</p>
    </div>

    <div style="margin-top: 25px; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 8px rgba(0,0,0,0.05);">
      <p>Dear ${details.bakeryName || 'Baker'},</p>
      <p>
        The following items have reached their low stock threshold:
      </p>

      <ul style="padding-left: 20px; margin: 0;">
        ${
          details.lowStockItems.length > 0
            ? details.lowStockItems
                .map(
                  (item) => `
            <li>
              <strong>${item.name}</strong> — ${item.remaining} remaining 
              ${item.unit ? `(${item.unit})` : ''}
            </li>
          `
                )
                .join('')
            : '<li>No low stock items at the moment.</li>'
        }
      </ul>

      <p style="margin-top: 20px;">
        Keeping your shelves stocked ensures happy customers and smooth daily operations 🧁
      </p>
    </div>

    <div style="text-align: center; margin-top: 25px;">
      <a href="https://manager.twoo.com/inventory" 
         style="background-color: #d17a22; color: #fff; text-decoration: none; font-weight: bold; 
                padding: 12px 28px; border-radius: 8px; display: inline-block;">
        Review Inventory
      </a>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 14px; color: #8c6e50;">
      <p>Stay one step ahead — a well-stocked bakery is a happy bakery 🍩</p>
      <p><strong>The Twoo Bakery Manager Team 🍪</strong></p>
      <p style="font-size: 12px; color: #b8a68a;">© ${new Date().getFullYear()} Twoo. All rights reserved.</p>
    </div>
  </div>
  `;

  const text = `
  Low Stock Alert ⚠️ - ${details.bakeryName || 'Your Bakery'}

  Dear ${details.bakeryName || 'Baker'},

  The following items are running low:
  ${
    details.lowStockItems.length > 0
      ? details.lowStockItems
          .map((item) => `${item.name} — ${item.remaining} remaining ${item.unit ? `(${item.unit})` : ''}`)
          .join('\n')
      : 'No low stock items at the moment.'
  }

  Visit your inventory dashboard to review and restock:
  https://manager.twoo.com/inventory

  Stay one step ahead — a well-stocked bakery is a happy bakery 🍩
  — The Twoo Bakery Manager Team
  `;

  await sendEmail(to, subject, text, html);
};

/** Send monthly performance summary email
 * @param {string} to
 * @param {Object} summary
 * @returns {Promise}
 */

const sendMonthlyPerformanceSummaryEmail = async (to, summary) => {
  const subject = `🎉 ${summary.month} Performance Summary - Twoo Bakery Manager`;

  const html = `
  <div style="font-family: 'Segoe UI', sans-serif; background-color: #fffaf2; padding: 30px; border-radius: 12px; color: #4a3b2a;">
    <div style="text-align: center;">
      <img src="https://yourcdn.com/twoo-bakery-logo.png" alt="Twoo Bakery Manager" style="width: 120px; margin-bottom: 20px;" />
      <h2 style="margin: 0; color: #d17a22;">${summary.month} Performance Summary 🧁</h2>
      <p style="margin-top: 10px; font-size: 16px;">Here’s a sweet look at how your bakery performed this month!</p>
    </div>

    <div style="margin-top: 25px; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 8px rgba(0,0,0,0.05);">
      <h3 style="color: #d17a22;">📊 Highlights</h3>
      <p><strong>Total Orders:</strong> ${summary.totalOrders}</p>
      <p><strong>Total Sales:</strong> ${summary.totalSales.toFixed(2)} ${summary.currency}</p>
      <p><strong>Average Order Value:</strong> ${summary.averageOrderValue.toFixed(2)} ${summary.currency}</p>
      <p><strong>Growth vs Last Month:</strong> ${summary.growthPercentage >= 0 ? '+' : ''}${summary.growthPercentage}%</p>

      <hr style="border: none; border-top: 1px solid #f0e6d5; margin: 20px 0;" />

      <h3 style="color: #d17a22;">🥐 Top 5 Best-Selling Items</h3>
      <ul style="padding-left: 20px; margin: 0;">
        ${
          summary.topItems.length > 0
            ? summary.topItems
                .slice(0, 5)
                .map(
                  (item) => `
          <li>${item.name} — ${item.quantitySold} sold (${item.totalSales.toFixed(2)} ${summary.currency})</li>
        `
                )
                .join('')
            : '<li>No sales data available.</li>'
        }
      </ul>

      ${
        summary.newCustomers > 0
          ? `
        <hr style="border: none; border-top: 1px solid #f0e6d5; margin: 20px 0;" />
        <h3 style="color: #d17a22;">👋 New Customers</h3>
        <p>You welcomed <strong>${summary.newCustomers}</strong> new customers this month!</p>
      `
          : ''
      }

      ${
        summary.lowStockItems?.length > 0
          ? `
        <hr style="border: none; border-top: 1px solid #f0e6d5; margin: 20px 0;" />
        <h3 style="color: #d17a22;">⚠️ Items to Watch</h3>
        <ul style="padding-left: 20px; margin: 0;">
          ${summary.lowStockItems
            .map(
              (item) => `
            <li>${item.name} — ${item.remaining} left</li>
          `
            )
            .join('')}
        </ul>
      `
          : ''
      }
    </div>

    <div style="text-align: center; margin-top: 25px;">
      <a href="https://manager.twoo.com/dashboard" 
         style="background-color: #d17a22; color: #fff; text-decoration: none; font-weight: bold; 
                padding: 12px 28px; border-radius: 8px; display: inline-block;">
        View Full Insights
      </a>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 14px; color: #8c6e50;">
      <p>Keep up the great work — your bakery is rising beautifully! 🥖</p>
      <p><strong>The Twoo Bakery Manager Team 🍪</strong></p>
      <p style="font-size: 12px; color: #b8a68a;">© ${new Date().getFullYear()} Twoo. All rights reserved.</p>
    </div>
  </div>
  `;

  const text = `
  ${summary.month} Performance Summary - Twoo Bakery Manager

  Total Orders: ${summary.totalOrders}
  Total Sales: ${summary.totalSales.toFixed(2)} ${summary.currency}
  Average Order Value: ${summary.averageOrderValue.toFixed(2)} ${summary.currency}
  Growth vs Last Month: ${summary.growthPercentage >= 0 ? '+' : ''}${summary.growthPercentage}%

  Top 5 Best-Selling Items:
  ${
    summary.topItems.length > 0
      ? summary.topItems
          .slice(0, 5)
          .map((item) => `${item.name} — ${item.quantitySold} sold (${item.totalSales.toFixed(2)} ${summary.currency})`)
          .join('\n')
      : 'No sales data available.'
  }

  ${summary.newCustomers > 0 ? `New Customers: ${summary.newCustomers}` : ''}
  ${
    summary.lowStockItems?.length > 0
      ? `
  Items to Watch:
  ${summary.lowStockItems.map((item) => `${item.name} — ${item.remaining} left`).join('\n')}
  `
      : ''
  }

  View detailed insights: https://manager.twoo.com/dashboard

  Keep up the great work — your bakery is rising beautifully! 🥖
  — The Twoo Bakery Manager Team
  `;

  await sendEmail(to, subject, text, html);
};

/** Send staff invitation email
 * @param {string} to
 * @param {Object} details
 * @returns {Promise}
 */

const sendStaffInvitationEmail = async (to, details) => {
  const subject = `You're Invited to Join ${details.bakeryName || 'Twoo Bakery Manager'} 🍰`;

  const html = `
  <div style="font-family: 'Segoe UI', sans-serif; background-color: #fffaf2; padding: 30px; border-radius: 12px; color: #4a3b2a;">
    <div style="text-align: center;">
      <img src="https://yourcdn.com/twoo-bakery-logo.png" alt="Twoo Bakery Manager" style="width: 120px; margin-bottom: 20px;" />
      <h2 style="margin: 0; color: #d17a22;">Welcome to the Team! 🥐</h2>
      <p style="margin-top: 10px; font-size: 16px;">${
        details.inviterName || 'Your manager'
      } has invited you to join <strong>${details.bakeryName || 'your bakery'}</strong> on Twoo Bakery Manager.</p>
    </div>

    <div style="margin-top: 25px; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 8px rgba(0,0,0,0.05);">
      <p>Dear ${details.staffName || 'Team Member'},</p>
      <p>
        You’ve been added as a <strong>${details.role || 'Staff Member'}</strong> on your bakery’s account.
        Twoo Bakery Manager helps your team manage orders, track inventory, and stay on top of daily operations 🍞
      </p>

      <p style="margin-top: 15px;">Click the button below to set up your account and get started:</p>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${details.inviteLink}" 
           style="background-color: #d17a22; color: #fff; text-decoration: none; font-weight: bold;
                  padding: 12px 28px; border-radius: 8px; display: inline-block;">
          Accept Invitation
        </a>
      </div>

      <p>This invitation will expire in <strong>24 hours</strong> for security reasons.</p>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 14px; color: #8c6e50;">
      <p>Can’t wait to see what you’ll bake up together! 🧁</p>
      <p><strong>The Twoo Bakery Manager Team 🍪</strong></p>
      <p style="font-size: 12px; color: #b8a68a;">© ${new Date().getFullYear()} Twoo. All rights reserved.</p>
    </div>
  </div>
  `;

  const text = `
  Welcome to the Team! 🥐

  ${details.inviterName || 'Your manager'} has invited you to join ${
    details.bakeryName || 'your bakery'
  } on Twoo Bakery Manager as a ${details.role || 'Staff Member'}.

  Use the link below to set up your account:
  ${details.inviteLink}

  This invitation will expire in 24 hours.

  Can’t wait to see what you’ll bake up together! 🧁
  — The Twoo Bakery Manager Team
  `;

  await sendEmail(to, subject, text, html);
};

/** Send staff activation confirmation email
 * @param {string} to
 * @param {Object} details
 * @returns {Promise}
 */

const sendStaffActivationConfirmationEmail = async (to, details) => {
  const subject = `Welcome Aboard, ${details.staffName || 'Baker'}! 🧁 - Twoo Bakery Manager`;

  const html = `
  <div style="font-family: 'Segoe UI', sans-serif; background-color: #fffaf2; padding: 30px; border-radius: 12px; color: #4a3b2a;">
    <div style="text-align: center;">
      <img src="https://yourcdn.com/twoo-bakery-logo.png" alt="Twoo Bakery Manager" style="width: 120px; margin-bottom: 20px;" />
      <h2 style="margin: 0; color: #d17a22;">Welcome Aboard, ${details.staffName || 'Baker'}! 🎉</h2>
      <p style="margin-top: 10px; font-size: 16px;">You’ve successfully joined <strong>${
        details.bakeryName || 'your bakery'
      }</strong> on Twoo Bakery Manager.</p>
    </div>

    <div style="margin-top: 25px; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 8px rgba(0,0,0,0.05);">
      <p>We’re thrilled to have you as part of the team! 🥖</p>

      <p>
        As a <strong>${details.role || 'Staff Member'}</strong>, you now have access to the bakery dashboard where you can
        manage daily tasks, process orders, and help keep the bakery running smoothly.
      </p>

      <div style="text-align: center; margin: 25px 0;">
        <a href="https://manager.twoo.com/login"
           style="background-color: #d17a22; color: #fff; text-decoration: none; font-weight: bold;
                  padding: 12px 28px; border-radius: 8px; display: inline-block;">
          Go to Dashboard
        </a>
      </div>

      <p style="margin-top: 20px;">
        If you ever need help getting started, visit our <a href="https://help.twoo.com/bakery" style="color: #d17a22; text-decoration: none;">Help Center</a> 
        or reach out to your manager.
      </p>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 14px; color: #8c6e50;">
      <p>Here’s to many sweet successes ahead! 🍩</p>
      <p><strong>The Twoo Bakery Manager Team 🍪</strong></p>
      <p style="font-size: 12px; color: #b8a68a;">© ${new Date().getFullYear()} Twoo. All rights reserved.</p>
    </div>
  </div>
  `;

  const text = `
  Welcome Aboard, ${details.staffName || 'Baker'}! 🎉

  You’ve successfully joined ${details.bakeryName || 'your bakery'} on Twoo Bakery Manager.

  Role: ${details.role || 'Staff Member'}

  You can now log in and start helping your team manage the bakery:
  https://manager.twoo.com/login

  Need help getting started? Visit our help center: https://help.twoo.com/bakery

  Here’s to many sweet successes ahead! 🍩
  — The Twoo Bakery Manager Team
  `;

  await sendEmail(to, subject, text, html);
};

/**
 * Get email provider type
 * @returns {string}
 */
const getProviderType = () => {
  return resend ? 'resend' : 'mock';
};

/**
 * Get mock emails (for testing)
 * @returns {Array}
 */
const getMockEmails = () => {
  return Array.from(mockEmails.values());
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendNewOrderNotificationEmail,
  getProviderType,
  getMockEmails,
  sendVerificationEmailForMobile,
  sendResetPasswordEmailForMobile,
  sendOneTimePasswordForMobile,
  sendMonthlyPerformanceSummaryEmail,
  sendLowStockAlertEmail,
  sendDailySalesSummaryEmail,
  sendSubscriptionConfirmationEmail,
  sendStaffInvitationEmail,
  sendStaffActivationConfirmationEmail,
  sendOwnerNewOrderNotificationEmail,
};
