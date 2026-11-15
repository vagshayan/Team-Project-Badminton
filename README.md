# Tournament Management System
> Elite Multi-Sport Management Platform for University Tournaments.

## 🌟 Key Features
- **Multi-Sport Support**: Specialized modules for Badminton, Table Tennis, and Carrom.
- **Admin Dashboard**: Effortless tournament creation and player management.
- **Public Portal**: Smooth registration for students and real-time tournament tracking.
- **Data Export**: Export player lists and results to PDF and CSV formats.
- **High Contrast UI**: Professional design tailored for sports event management.

## 🛠️ Getting Started (For Team Members)
Follow these steps to set up the project locally:

### 1. Install Dependencies
Run this in the main folder to install root tools:
```bash
npm install
```

### 2. Setup Backend
```bash
cd backend
npm install
# Create a .env file with MONGODB_URI, JWT_SECRET, ADMIN_ACCESS_CODE, and SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, BACKEND_URL, and FRONTEND_URL for email verification
node server.js
```

All team members must configure the backend with the same `MONGODB_URI` and database name to share admins, tournaments, and profile photos. The `.env` file is intentionally gitignored and should be configured locally without committing credentials. New admin photos are stored in MongoDB, not in the repository; older photos saved under `backend/uploads/` are local-only and must be uploaded again from the machine that has the original file.

For Gmail, enable 2-Step Verification and create an App Password. Put the Gmail address in `SMTP_USER` and the 16-character App Password in `SMTP_PASS`. Do not use the normal Gmail account password.

### Migrate existing admin roles
Before deploying the single-admin-role version, normalize any previously promoted accounts to the regular admin role:
```bash
npm --prefix backend run migrate-admin-roles
```
The command connects to the database configured in `backend/.env` and changes legacy `super_admin` role values to `admin`. Back up the database before running it.

### 3. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

`npm run dev` starts the frontend over HTTPS. The development server uses a self-signed certificate by default, which browsers may not trust. For LAN access without a certificate warning, configure `SSL_CRT_FILE` and `SSL_KEY_FILE` to point to a certificate trusted by the device and valid for the host name or IP address. `npm start` remains the standard HTTP startup command.

## 🔐 Technologies Used
- **Frontend**: React.js, Vite, Vanilla CSS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas (Cloud)

Multi-Sport Management
# Tournament Management System
> Elite Multi-Sport Management Platform for University Tournaments.

## 🌟 Key Features
- **Multi-Sport Support**: Specialized modules for Badminton, Table Tennis, and Carrom.
- **Admin Dashboard**: Effortless tournament creation and player management.
- **Public Portal**: Smooth registration for students and real-time tournament tracking.
- **Data Export**: Export player lists and results to PDF and CSV formats.
- **High Contrast UI**: Professional design tailored for sports event management.

## 🛠️ Getting Started (For Team Members)
Follow these steps to set up the project locally:

### 1. Install Dependencies
Run this in the main folder to install root tools:
```bash
npm install
```

### 2. Setup Backend
```bash
cd backend
npm install
# Create a .env file and add your MONGODB_URI
node server.js
```

### 3. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔐 Technologies Used
- **Frontend**: React.js, Vite, Vanilla CSS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas (Cloud)
