# LAPEN Agenda API Documentation

## Base URL
- Development: `http://localhost:5001`
- Production: Your deployed URL

## Interactive Documentation
Access the interactive Swagger UI at: `http://localhost:5001/api/docs`

## Authentication

### User Authentication (JWT)
- Header: `Authorization: Bearer {token}`
- Obtained from `/api/auth/login` or `/api/auth/register`

### Admin Authentication (Session)
- Session-based authentication
- Login via `/api/admin/login`
- Session cookie automatically included

---

## Public Endpoints

### GET /api/public/courts
Get all active courts.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Quadra 1",
    "type": "saibro",
    "description": "Quadra principal",
    "active": true,
    "image_url": "/images/court_1.jpg"
  }
]
```

### GET /api/public/players
Get all players for autocomplete.

**Response:**
```json
["João Silva", "Maria Santos", "Pedro Costa"]
```

### GET /api/public/available-times
Get available time slots for a court and date.

**Query Parameters:**
- `court_id` (required): Court ID
- `date` (required): Date in YYYY-MM-DD format

**Response:**
```json
["07:30", "09:00", "10:30", "12:00"]
```

### POST /api/public/schedules
Create a new schedule.

**Request Body:**
```json
{
  "court_id": 1,
  "date": "2024-01-15",
  "start_time": "09:00",
  "player1_name": "João Silva",
  "player2_name": "Maria Santos",
  "match_type": "Liga"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Schedule created successfully"
}
```

### PUT /api/public/schedules/{schedule_id}
Update an existing schedule.

**Request Body:**
```json
{
  "player1_name": "João Silva",
  "player2_name": "Pedro Costa",
  "match_type": "Amistoso"
}
```

### DELETE /api/public/schedules/{schedule_id}
Delete a schedule.

### GET /api/public/schedules/month
Get schedules for a specific month.

**Query Parameters:**
- `year` (optional): Year (default: current year)
- `month` (optional): Month 1-12 (default: current month)

### GET /api/public/schedules/week
Get schedules for a specific week.

**Query Parameters:**
- `date` (optional): Date in YYYY-MM-DD format (default: today)

### GET /api/public/whatsapp-message
Generate WhatsApp message with schedules.

**Query Parameters:**
- `year` (optional): Year
- `month` (optional): Month

**Response:**
```json
{
  "message": "📅 *Agenda LAPEN - Janeiro 2024*\n\n..."
}
```

### GET /api/public/dashboard-stats
Get public dashboard statistics.

**Response:**
```json
{
  "mostBookedCourt": {"name": "Quadra 1", "bookings": 25},
  "gameStats": [{"match_type": "Liga", "count": 15}],
  "topPlayers": [{"player_name": "João Silva", "games": 12}]
}
```

---

## Authentication Endpoints

### POST /api/auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "João Silva",
  "phone": "+5511999999999"
}
```

**Response:**
```json
{
  "message": "Usuário cadastrado com sucesso",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "João Silva",
    "phone": "+5511999999999",
    "is_verified": false
  }
}
```

### POST /api/auth/login
User login.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login realizado com sucesso",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "João Silva",
    "is_verified": true
  }
}
```

### GET /api/auth/me
Get current user info.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "João Silva",
    "is_verified": true
  }
}
```

### POST /api/auth/verify
Verify email with token.

**Request Body:**
```json
{
  "token": "verification_token_here"
}
```

### POST /api/auth/change-password
Change user password.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "current_password": "oldpass123",
  "new_password": "newpass456"
}
```

---

## Admin Endpoints

### POST /api/admin/login
Admin login.

**Request Body:**
```json
{
  "password": "PTCadmin2025"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful"
}
```

### POST /api/admin/logout
Admin logout.

### GET /api/admin/courts
Get all courts (admin).

**Auth:** Admin session required

### POST /api/admin/courts
Create a new court.

**Auth:** Admin session required

**Request Body:**
```json
{
  "name": "Quadra 3",
  "type": "saibro",
  "description": "Nova quadra",
  "active": true,
  "image": "data:image/jpeg;base64,..."
}
```

### PUT /api/admin/courts/{court_id}
Update a court.

**Auth:** Admin session required

### DELETE /api/admin/courts/{court_id}
Delete a court.

**Auth:** Admin session required

### GET /api/admin/players
Get all players.

**Auth:** Admin session required

### POST /api/admin/players
Add a new player.

**Auth:** Admin session required

**Request Body:**
```json
{
  "name": "Carlos Oliveira"
}
```

### DELETE /api/admin/players/{player_id}
Delete a player.

**Auth:** Admin session required

### GET /api/admin/holidays-blocks
Get all holidays/blocks.

### POST /api/admin/holidays-blocks
Create a holiday/block.

**Auth:** Admin session required

**Request Body:**
```json
{
  "date": "2024-12-25",
  "start_time": null,
  "end_time": null,
  "description": "Christmas"
}
```

### DELETE /api/admin/holidays-blocks/{block_id}
Delete a holiday/block.

**Auth:** Admin session required

### GET /api/admin/recurring-schedules
Get all recurring schedules.

### POST /api/admin/recurring-schedules
Create recurring schedules.

**Auth:** Admin session required

**Request Body:**
```json
{
  "court_id": 1,
  "days_of_week": [0, 2, 4],
  "times": ["09:00", "14:00"],
  "description": "Aulas regulares",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```

### DELETE /api/admin/recurring-schedules/{schedule_id}
Delete a recurring schedule.

**Auth:** Admin session required

### GET /api/admin/dashboard
Get admin dashboard statistics.

**Auth:** Admin session required

---

## Match Management Endpoints

### GET /api/matches/
Get available matches for betting.

**Query Parameters:**
- `include_all` (optional): Include all matches (admin only)

**Headers (optional):** `Authorization: Bearer {token}`

**Response:**
```json
{
  "matches": [
    {
      "schedule_id": 1,
      "match_id": 1,
      "court_name": "Quadra 1",
      "date": "2024-01-15",
      "start_time": "09:00",
      "player1_name": "João Silva",
      "player2_name": "Maria Santos",
      "match_type": "Liga",
      "status": "upcoming",
      "betting_enabled": true,
      "total_pool": 150.00,
      "user_has_bet": false
    }
  ]
}
```

### POST /api/matches/create
Create a match from schedule.

**Auth:** User token required

**Request Body:**
```json
{
  "schedule_id": 1,
  "betting_enabled": true
}
```

### POST /api/matches/{match_id}/toggle-betting
Enable/disable betting for a match.

**Auth:** User token required

### PUT /api/matches/{match_id}/status
Update match status.

**Auth:** User token required

**Request Body:**
```json
{
  "status": "live"
}
```

---

## Admin Match Management

### POST /api/admin/matches/{match_id}/finish
Finish a match and settle bets.

**Auth:** Admin session required

**Request Body:**
```json
{
  "winner_name": "João Silva",
  "score": "6-4, 6-2"
}
```

**Response:**
```json
{
  "message": "Partida finalizada e apostas liquidadas",
  "total_pool": 200.00,
  "total_winnings": 160.00,
  "winning_bets_count": 5
}
```

### POST /api/admin/matches/{match_id}/cancel
Cancel a match and refund bets.

**Auth:** Admin session required

**Response:**
```json
{
  "message": "Partida cancelada",
  "refunded_bets": 8,
  "failed_refunds": 0,
  "total_bets": 8
}
```

### GET /api/admin/matches/{match_id}/report
Get comprehensive match report.

**Response:**
```json
{
  "match": {
    "player1_name": "João Silva",
    "player2_name": "Maria Santos",
    "date": "2024-01-15",
    "start_time": "09:00",
    "status": "finished"
  },
  "bets": [...],
  "summary": {
    "winner": "João Silva",
    "score": "6-4, 6-2",
    "total_pool": 200.00,
    "total_bettors": 10,
    "total_winnings": 160.00
  }
}
```

### GET /api/admin/matches/{match_id}/result
Get match result.

### GET /api/admin/matches/reports
Get betting reports and statistics.

---

## Betting Endpoints

### POST /api/betting/create-payment-intent
Create payment intent for a bet.

**Auth:** User token required

**Request Body:**
```json
{
  "schedule_id": 1,
  "player_name": "João Silva",
  "amount": 50.00,
  "payment_method": "pix",
  "device_id": "device_fingerprint_123"
}
```

**Response (PIX):**
```json
{
  "success": true,
  "payment_id": "123456789",
  "qr_code": "00020126580014br.gov.bcb.pix...",
  "qr_code_base64": "data:image/png;base64,...",
  "amount": 50.00
}
```

### POST /api/betting/place-bet
Place a bet after payment confirmation.

**Auth:** User token required

**Request Body:**
```json
{
  "schedule_id": 1,
  "player_name": "João Silva",
  "amount": 50.00,
  "payment_intent_id": "123456789",
  "payment_method": "pix"
}
```

**Response:**
```json
{
  "message": "Aposta realizada com sucesso",
  "bet_id": 1,
  "amount": 50.00,
  "player": "João Silva",
  "potential_return": 95.00
}
```

### GET /api/betting/my-bets
Get user's betting history.

**Auth:** User token required

**Response:**
```json
{
  "bets": [
    {
      "id": 1,
      "amount": 50.00,
      "player_name": "João Silva",
      "status": "active",
      "potential_return": 95.00,
      "created_at": "2024-01-10 14:30:00",
      "match": {
        "id": 1,
        "match_id": 1,
        "date": "2024-01-15",
        "start_time": "09:00",
        "player1_name": "João Silva",
        "player2_name": "Maria Santos",
        "status": "upcoming"
      }
    }
  ]
}
```

### GET /api/betting/match/{match_id}/bets
Get betting statistics for a match.

**Response:**
```json
{
  "match": {
    "player1_name": "João Silva",
    "player2_name": "Maria Santos",
    "total_pool": 200.00,
    "status": "upcoming",
    "betting_enabled": true
  },
  "betting_stats": {
    "João Silva": {
      "bet_count": 5,
      "total_amount": 120.00
    },
    "Maria Santos": {
      "bet_count": 3,
      "total_amount": 80.00
    }
  },
  "odds": {
    "João Silva": 1.67,
    "Maria Santos": 2.50
  },
  "payout_pool": 160.00
}
```

### DELETE /api/betting/cancel-bet/{bet_id}
Cancel a bet (upcoming matches only).

**Auth:** User token required

---

## Payment Endpoints

### POST /api/payments/webhook
Stripe webhook handler.

**Headers:** `Stripe-Signature`

### GET /api/payments/{payment_id}/status
Check payment status (Mercado Pago PIX).

**Response:**
```json
{
  "status": "approved"
}
```

### GET /api/payments/history/{user_id}
Get payment history for a user.

---

## Webhook Endpoints

### POST /api/webhooks/mercadopago
Mercado Pago payment notification webhook.

**Request Body:**
```json
{
  "type": "payment",
  "data": {
    "id": "123456789"
  }
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

---

## Data Models

### Court
```json
{
  "id": 1,
  "name": "Quadra 1",
  "type": "saibro",
  "description": "Quadra principal",
  "active": true,
  "image_url": "/images/court_1.jpg"
}
```

### Schedule
```json
{
  "id": 1,
  "court_id": 1,
  "date": "2024-01-15",
  "start_time": "09:00",
  "player1_name": "João Silva",
  "player2_name": "Maria Santos",
  "match_type": "Liga"
}
```

### Match
```json
{
  "id": 1,
  "schedule_id": 1,
  "status": "upcoming",
  "betting_enabled": true,
  "total_pool": 200.00,
  "house_edge": 0.20
}
```

### Bet
```json
{
  "id": 1,
  "user_id": 1,
  "match_id": 1,
  "player_name": "João Silva",
  "amount": 50.00,
  "status": "active",
  "potential_return": 95.00,
  "payment_id": "123456789",
  "created_at": "2024-01-10 14:30:00"
}
```

### User
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "João Silva",
  "phone": "+5511999999999",
  "is_verified": true
}
```

---

## Match Types
- `Liga` - League match
- `Amistoso` - Friendly match
- `Aula` - Lesson
- `Torneio` - Tournament

## Match Status
- `upcoming` - Scheduled, not started
- `live` - Currently in progress
- `finished` - Completed
- `cancelled` - Cancelled

## Bet Status
- `active` - Active bet
- `won` - Winning bet (settled)
- `lost` - Losing bet (settled)
- `refunded` - Refunded bet
- `pending` - Payment pending
- `failed` - Payment failed

## Payment Status (Mercado Pago)
- `pending` - Payment pending
- `approved` - Payment approved
- `authorized` - Payment authorized
- `in_process` - Payment in process
- `in_mediation` - Payment in mediation
- `rejected` - Payment rejected
- `cancelled` - Payment cancelled
- `refunded` - Payment refunded
- `charged_back` - Payment charged back
