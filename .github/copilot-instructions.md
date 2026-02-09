# Copilot Instructions for aviata-cashier-api

## Project Overview
This is a Node.js/Express RESTful API server using MongoDB (via Mongoose) for a sports betting cashier system. The codebase is based on a boilerplate but has custom business logic for player transfers, bets, games, and wallet management.

## Key Architectural Patterns
- **Layered Structure:**
  - `controllers/`: Handle HTTP requests, call services, return responses.
  - `services/`: Business logic, data orchestration, and cross-model operations.
  - `models/`: Mongoose schemas for MongoDB collections.
  - `middlewares/`: Express middleware for auth, validation, error handling, etc.
  - `routes/`: Route definitions, grouped by API version.
  - `utils/`: Shared helpers (e.g., `ApiError`, `catchAsync`).
  - `validations/`: Joi schemas for request validation.
- **Pagination:** Use the `paginate` plugin on models for paginated queries (see `PlayerTransferRequest.paginate`).
- **Error Handling:** Use `ApiError` and `catchAsync` for consistent error responses. Always throw `ApiError` for business logic errors.
- **Role-based Auth:** Permissions are defined in `config/roles.js` and enforced via the `auth` middleware.
- **Logging:** Use the logger from `config/logger.js` (Winston-based). API requests are also logged via Morgan.

## Developer Workflows
- **Run in Dev:** `yarn dev` (uses nodemon, auto-reloads)
- **Run in Prod:** `yarn start` (uses PM2)
- **Run Tests:** `yarn test` (Jest)
- **Lint:** `yarn lint` / `yarn lint:fix`
- **Format:** `yarn prettier` / `yarn prettier:fix`
- **Docker:** Use `yarn docker:dev` or `yarn docker:prod` for containerized runs. Compose files are provided for different environments.
- **API Docs:** Swagger UI at `/v1/docs` when running locally.

## Project-Specific Conventions
- **Transfer Requests:**
  - Use `PlayerTransferRequest` for all player money movement. Creation, approval, rejection, and cancellation are handled in `playerTransferRequest.service.js`.
  - Always check player existence and balance before processing withdrawals.
  - All transfer requests are assigned a unique 6-digit code.
- **Testing:**
  - Tests are in `test/` and `tests/` (integration/unit/fixtures). Use Jest for all test types.
- **Validation:**
  - All incoming requests should be validated using Joi schemas in `validations/` and the `validate` middleware.
- **Error Responses:**
  - Always return errors using the centralized error handler. Never send raw errors to the client.
- **Environment:**
  - Config via `.env`. See `.env.example` for required variables.

## Integration Points
- **MongoDB:** All data is stored in MongoDB via Mongoose models.
- **Authentication:** JWT-based, with Passport.js integration.
- **Email:** SMTP config in `.env`, used by `email.service.js`.
- **Swagger:** API docs auto-generated from route comments.

## Examples
- **Paginated Query:**
  ```js
  const results = await PlayerTransferRequest.paginate(filter, options);
  ```
- **Error Handling:**
  ```js
  if (!player) throw new ApiError(httpStatus.NOT_FOUND, 'Player not found');
  ```
- **Validation in Route:**
  ```js
  router.post('/users', validate(userValidation.createUser), userController.createUser);
  ```

## Key Files
- `src/services/playerTransferRequest.service.js`: Core transfer logic
- `src/config/roles.js`: Role/permission definitions
- `src/utils/ApiError.js`, `src/utils/catchAsync.js`: Error handling
- `README.md`: Full developer guide

---

If you are unsure about a pattern, check the README or look for similar usage in the `controllers/` and `services/` directories.
