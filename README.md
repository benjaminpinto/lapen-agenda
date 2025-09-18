# LAPEN Agenda - Tennis Court Management System

## Project Structure

```
lapen-agenda/
├── src/
│   ├── components/           # React components
│   │   ├── admin/           # Admin panel components
│   │   ├── ui/              # UI utility components
│   │   ├── Header.jsx
│   │   ├── Home.jsx
│   │   ├── ScheduleForm.jsx
│   │   └── ScheduleView.jsx
│   ├── database/            # Database related files
│   │   └── schema.sql
│   ├── routes/              # Flask API routes
│   │   ├── admin.py         # Admin API endpoints
│   │   └── public.py        # Public API endpoints
│   ├── static/              # Static files served by Flask
│   │   ├── images/          # Court images
│   │   └── index.html       # Production build output
│   ├── App.jsx              # Main React app component
│   ├── main.jsx             # React entry point
│   ├── database.py          # Database connection utilities
│   ├── index.css            # Global styles
│   └── App.css              # App-specific styles
├── main.py                  # Flask application entry point
├── package.json             # Node.js dependencies
├── requirements.txt         # Python dependencies
├── vite.config.js           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── index.html               # Development HTML template
```

## Setup Instructions

### Backend (Flask)
1. Install Python dependencies: `pip install -r requirements.txt`
2. Run the Flask server: `python main.py`

### Frontend (React + Vite)
1. Install Node.js dependencies: `npm install`
2. Start development server: `npm run dev`
3. Build for production: `npm run build`

## API Endpoints

### Public Routes (`/api/public`)
- GET `/courts` - Get active courts
- GET `/players` - Get players for autocomplete
- GET `/available-times` - Get available time slots
- POST `/schedules` - Create new schedule
- PUT `/schedules/<id>` - Update schedule
- DELETE `/schedules/<id>` - Delete schedule
- GET `/schedules/month` - Get monthly schedules
- GET `/schedules/week` - Get weekly schedules
- GET `/whatsapp-message` - Generate WhatsApp message

### Admin Routes (`/api/admin`)
- POST `/login` - Admin login
- POST `/logout` - Admin logout
- CRUD operations for courts, players, holidays/blocks, and recurring schedules
- GET `/dashboard` - Dashboard statistics