
# ✨ TrimBook Server — Luxury Salon & Spa Booking API

**TrimBook Server** is the backend REST API for TrimBook, a modern full-stack salon and spa appointment booking and management platform. It handles authentication verification, role-based authorization, service management, appointment booking, user administration, and secure online payments.

Built with **Node.js, Express.js, MongoDB Native Driver, BetterAuth, and Stripe**, the backend provides secure and reliable API services for the TrimBook frontend application.

<p align="center">
  <a href="https://trimbook-server.vercel.app">Live Server</a> •
  <a href="https://github.com/sajibkingo/TrimBook-server">Server Repository</a> •
  <a href="https://github.com/sajibkingo/TrimBook-client">Client Repository</a>
</p>

---

## 🌟 Key Features

### 🔐 Authentication & Authorization

- BetterAuth session token verification.
- Supports Bearer token and HTTP-only cookie authentication.
- Secure authentication middleware.
- Role-Based Access Control (RBAC).
- Separate access permissions for Administrators and Customers.
- Protected API endpoints using custom middleware.

### 💇 Service Management

- Create, read, update, and delete salon and spa services.
- Retrieve all available services.
- Retrieve individual service details.
- Admin access to all services, including unavailable services.
- Update service information and availability.

### 📅 Appointment Management

- Create customer appointment requests.
- Retrieve appointments for authenticated customers.
- Admin access to all customer appointments.
- Manage appointment statuses:
  - Pending
  - Confirmed
  - Completed
  - Cancelled
- Customer appointment cancellation.

### 💳 Payment Integration

- Stripe Checkout Session API integration.
- Secure payment session generation.
- Payment processing for confirmed appointments.
- Payment status management.
- Transaction recording and management.
- Admin access to payment transactions.

### 👥 User Management

- Retrieve registered users.
- Update user roles.
- Manage account blocking and activation.
- Restrict administrative operations to authorized administrators.

---

## 🧰 Technology Stack

| Category | Technologies |
|---|---|
| Runtime | Node.js |
| Backend Framework | Express.js |
| Database | MongoDB Native Driver |
| Authentication | BetterAuth |
| Authorization | Bearer Token & Cookie-Based Session Verification |
| Payment Gateway | Stripe |
| Deployment | Vercel |
| Environment Configuration | dotenv |
| Middleware | CORS, verifyToken, verifyAdmin |

---

## 🏗️ Project Structure

```text
TrimBook-server/
│
├── api/
│   └── index.js
│
├── middlewares/
│   ├── verifyAdmin.js
│   └── verifyToken.js
│
├── .gitignore
├── index.js
├── nodemon.json
├── package.json
├── package-lock.json
├── vercel.json
└── README.md
```

### Directory & File Overview

| File / Directory | Description |
|---|---|
| `api/` | Contains the API entry point for Vercel deployment |
| `api/index.js` | Serverless API entry point |
| `middlewares/` | Contains authentication and authorization middleware |
| `verifyToken.js` | Verifies authenticated user sessions |
| `verifyAdmin.js` | Verifies administrator permissions |
| `index.js` | Main Express server configuration and API implementation |
| `.gitignore` | Specifies files and directories excluded from Git |
| `nodemon.json` | Nodemon development configuration |
| `package.json` | Project dependencies and scripts |
| `package-lock.json` | Locks dependency versions |
| `vercel.json` | Vercel deployment configuration |

> **Note:** The `.env` file and `node_modules/` directory are used locally but should be excluded from the GitHub repository.

---

## 🔗 API Documentation

The following tables provide an overview of the available API endpoints.

### 1. Service Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/services` | Public | Get all active salon services |
| `GET` | `/api/services/:id` | Public | Get single service details |
| `GET` | `/api/services/admin/all` | Admin | Get all services, including unavailable |
| `POST` | `/api/services` | Admin | Add a new salon service |
| `PATCH` | `/api/services/:id` | Admin | Update service details or availability |
| `DELETE` | `/api/services/:id` | Admin | Delete a service |

### 2. Appointment Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/appointments` | Customer | Book a new appointment |
| `GET` | `/api/appointments/my` | Customer | Get logged-in customer's appointments |
| `GET` | `/api/appointments/admin/all` | Admin | Get all customer appointments |
| `PATCH` | `/api/appointments/:id/status` | Admin | Update appointment status |

### 3. Payment Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/payments/create-checkout-session` | Customer | Create Stripe Checkout session |
| `GET` | `/api/payments/admin/all` | Admin | View all payment transactions |

### 4. User Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/users` | Admin | Get all registered users |
| `PATCH` | `/api/users/:id/role` | Admin | Update user role or block status |

---

## 🔄 Appointment & Payment Workflow

TrimBook follows a structured appointment and payment process:

1. Customers browse available salon and spa services.
2. Customers select their preferred appointment date and time.
3. Customers submit an appointment request.
4. Administrators review the booking request.
5. Administrators confirm or update the appointment status.
6. Customers proceed to payment for confirmed appointments.
7. The backend generates a Stripe Checkout session.
8. Stripe processes the payment.
9. The application manages payment status and transaction records.

---

## 🔐 Authentication & Security

TrimBook uses **BetterAuth** for authentication and custom Express middleware for backend authorization.

### Authentication Middleware

**`verifyToken.js`**

- Verifies authenticated requests.
- Supports Bearer token authentication.
- Supports HTTP-only session cookies.
- Protects private API endpoints.

**`verifyAdmin.js`**

- Verifies administrator permissions.
- Restricts sensitive administrative operations.
- Prevents unauthorized access to management endpoints.

### Security Features

- Session-based authentication.
- Protected API routes.
- Role-Based Access Control.
- Server-side authorization.
- Environment-based secret management.
- Secure Stripe secret key handling.

---

## ⚙️ Local Setup & Installation

Follow these instructions to run TrimBook Server locally.

### Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/)
- npm
- [Git](https://git-scm.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/sajibkingo/TrimBook-server.git
```

### 2. Navigate to the Project Directory

```bash
cd TrimBook-server
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory of the project.

Add the following environment variables:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
CLIENT_URL=http://localhost:3000
STRIPE_SECRET_KEY=your_stripe_secret_key
```

Replace the placeholder values with your actual credentials.

### 5. Start the Development Server

```bash
npm run dev
```

### 6. Access the Application

**Local Backend:**

```text
http://localhost:5000
```

**Live Backend:**

```text
https://trimbook-server.vercel.app
```

> **Important:** Never commit your `.env` file, database credentials, Stripe secret keys, or other sensitive information to GitHub.

---

## ☁️ Deployment

TrimBook Server is deployed using **Vercel**.

### Deployment Configuration

| Configuration | Details |
|---|---|
| Hosting Platform | Vercel |
| Deployment Type | Serverless Functions |
| Live Server | https://trimbook-server.vercel.app |
| Database | MongoDB |
| Deployment Configuration | `vercel.json` |

### Deployment Steps

1. Push the backend source code to GitHub.
2. Import the repository into Vercel.
3. Configure the required environment variables in Vercel project settings.
4. Configure the production deployment settings.
5. Deploy the application.
6. Verify the deployed API endpoints.

For production deployment, configure your MongoDB connection string, Stripe secret key, and frontend URL through Vercel environment variables.

---

## 🔗 Frontend Integration

TrimBook Server provides REST API endpoints consumed by the TrimBook frontend application.

**Frontend:** [TrimBook Client](https://github.com/sajibkingo/TrimBook-client)

**Backend:** [TrimBook Server](https://github.com/sajibkingo/TrimBook-server)

The frontend communicates with the backend to handle:

- User authentication and profile management.
- Service discovery and management.
- Appointment booking and tracking.
- Payment session creation.
- Transaction management.
- Administrative dashboard operations.

---

## 🚀 Future Improvements

- Real-time appointment availability.
- Advanced booking conflict prevention.
- Automated email and booking confirmation notifications.
- Enhanced API validation and error handling.
- API rate limiting and additional security.
- Advanced transaction reporting.
- Interactive API documentation using Swagger/OpenAPI.

---

## 👨‍💻 Author

**Sajib Kumar Saha**

Computer Science & Engineering Graduate | Full-Stack Web Development Enthusiast

- **GitHub:** [@sajibkingo](https://github.com/sajibkingo)

---

## 📂 Project Repositories

| Repository | Description |
|---|---|
| [TrimBook Server](https://github.com/sajibkingo/TrimBook-server) | Backend REST API |
| [TrimBook Client](https://github.com/sajibkingo/TrimBook-client) | Frontend Application |

---

<p align="center">
  ⭐ If you find this project interesting, consider giving the repository a star!
</p>

<p align="center">
  Built with ❤️ by Sajib Kumar Saha
</p>
