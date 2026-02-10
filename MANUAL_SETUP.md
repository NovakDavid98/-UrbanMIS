# Manual Installation Guide

**⚠️ RECOMMENDATION: Use the Docker setup described in `README.md` for the best experience.**

This guide covers the manual installation process if you cannot or shorter not to use Docker.

## Prerequisites
- Node.js v18 or higher
- PostgreSQL 14 or higher
- npm

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/NovakDavid98/-UrbanMIS.git UrbanMIS
   cd UrbanMIS
   ```

2. Set up the backend:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your database credentials and secrets
   npm install
   ```

3. Set up the frontend:
   ```bash
   cd ../frontend
   npm install
   # Return to root for next steps
   cd ..
   ```

4. Initialize the database:
   ```bash
   # Enter PostgreSQL interactive mode
   sudo -u postgres psql
   ```
   
   Inside the `postgres=#` prompt, run:
   ```sql
   CREATE DATABASE urbanmis;
   CREATE USER urbanmis WITH PASSWORD 'change_me_securely';
   GRANT ALL PRIVILEGES ON DATABASE urbanmis TO urbanmis;
   \c urbanmis
   GRANT ALL ON SCHEMA public TO urbanmis;
   \q
   ```

   Then import the schema (you will be prompted for the password 'change_me_securely'):
   ```bash
   psql -h localhost -U urbanmis -d urbanmis -f database/schema.sql
   ```

5. Start the development servers:
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev

   # Terminal 2: Frontend (open new terminal in project root)
   cd frontend && npm run dev
   ```

The application will be available at `http://localhost:5173`.
