# UrbanMIS

UrbanMIS is an open-source Management Information System designed for streetwork and humanitarian organizations. It transforms complex field operations into a streamlined digital workflow, providing a unified platform for case management, visit tracking, and team coordination.

**Made by David Novak from [DigitalHarbour.cz](https://digitalharbour.cz)**

## Features

### Case Management
- Comprehensive client profiles with demographics, contact information, and service history.
- Advanced filtering and search, including AI-powered natural language queries.
- Bulk data export to Excel for reporting.

### Visit Tracking
- Detailed visit log with worker attribution and time tracking.
- Date range filtering, category-based views, and full-text search.
- Exportable reports compliant with funding body requirements.

### Team Coordination
- Role-based access control (Admin, Worker).
- Internal announcement board with posts and team polls.
- Weekly activity planner with room/resource booking.

### Analytics and Reporting
- Dashboards for client demographics, service usage, and worker performance.
- Client timeline visualization showing registration trends.
- Geographic map view of client distribution.

## Technology Stack

- **Frontend**: React (Vite), Tailwind CSS
- **Backend**: Node.js (Express)
- **Database**: PostgreSQL
- **Authentication**: JWT

## Getting Started

### Quick Start with Docker

The fastest way to deploy UrbanMIS:

1. Clone the repository:
   ```bash
   git clone https://github.com/NovakDavid98/-UrbanMIS.git UrbanMIS
   cd UrbanMIS
   ```

2. Configure environment:
   ```bash
   cp .env.docker.example .env
   # Edit .env with secure passwords
   ```

3. Start the application:
   ```bash
   docker-compose up -d
   ```

The application will be available at `http://localhost`.

Default credentials: `admin` / `admin123` (change immediately after first login).

### Manual Installation

> **⚠️ RECOMMENDATION:** We highly advise using the **Docker setup** described above for the best experience. It handles all dependencies, database configuration, and environment setup automatically.

If you strictly require a manual installation without Docker, please refer to the [Manual Setup Guide](MANUAL_SETUP.md).

## Configuration

All configuration is managed through environment variables. See `.env.example` in the `backend` directory for available options.

## Project Structure

```
UrbanMIS/
├── backend/             # Node.js Express API
│   ├── config/          # Database configuration
│   ├── middleware/      # Auth, rate limiting, etc.
│   ├── routes/          # API endpoints
│   └── server.js        # Application entry point
├── frontend/            # React application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── layouts/     # Page layouts
│   │   ├── pages/       # Route-level components
│   │   ├── services/    # API client
│   │   └── store/       # Zustand state management
│   └── index.html
└── database/            # SQL schema and migrations
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request.
