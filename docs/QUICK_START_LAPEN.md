# Quick Start: LAPEN Member System

## 🚀 How to Use

### For Users

#### 1. Register as LAPEN Member
1. Go to `/signup`
2. Fill in your details
3. Select **SIM** for "Você é um membro da LAPEN?"
4. Submit registration
5. Wait for admin approval

#### 2. Check Status
- Login to see your status
- If pending: "Sua solicitação está pendente de aprovação"
- If approved: You can book courts!

#### 3. Book a Court (Approved Members Only)
1. Go to `/schedule`
2. Select court, date, time
3. Enter player names
4. Submit booking

### For Admins

#### 1. Access Admin Panel
1. Go to `/admin`
2. Enter admin password
3. Click "Membros LAPEN" card

#### 2. Approve/Reject Requests
1. View pending requests
2. Click "Aprovar" to approve
3. Click "Rejeitar" to reject
4. User can now book courts (if approved)

## 🔑 Permission Matrix

| Action | Non-Auth | Regular User | Pending LAPEN | Approved LAPEN |
|--------|----------|--------------|---------------|----------------|
| View Agenda | ✅ | ✅ | ✅ | ✅ |
| View Bets | ✅ | ✅ | ✅ | ✅ |
| Place Bets | ❌ | ✅ | ✅ | ✅ |
| Book Courts | ❌ | ❌ | ❌ | ✅ |
| Manage Bookings | ❌ | ❌ | ❌ | ✅ |

## 🛠️ Technical Details

### Database Fields Added
```sql
is_lapen_member BOOLEAN DEFAULT FALSE
lapen_approved BOOLEAN DEFAULT FALSE
lapen_requested_at TIMESTAMP
lapen_approved_at TIMESTAMP
lapen_approved_by INTEGER REFERENCES users(id)
```

### API Endpoints

#### User Registration
```bash
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name",
  "phone": "11999999999",
  "is_lapen_member": true  # NEW FIELD
}
```

#### Admin - List Requests
```bash
GET /api/admin/lapen-requests?status=pending
# Returns: [{ id, email, name, phone, lapen_requested_at }]
```

#### Admin - Approve
```bash
POST /api/admin/lapen-approve/123
# Returns: { success: true, message: "Membro LAPEN aprovado" }
```

#### Admin - Reject
```bash
POST /api/admin/lapen-reject/123
# Returns: { success: true, message: "Solicitação rejeitada" }
```

### Frontend Usage

#### Check Permissions
```javascript
import { useAuth } from '@/contexts/AuthContext'

const { canBookCourts, canPlaceBets, user } = useAuth()

if (canBookCourts) {
  // Show booking form
}

if (user?.is_lapen_member && !user?.lapen_approved) {
  // Show "pending approval" message
}
```

## 🧪 Testing Workflow

### Test 1: Register as LAPEN Member
```bash
# 1. Register
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lapen@test.com",
    "password": "test123",
    "name": "Test User",
    "is_lapen_member": true
  }'

# Expected: Success with "pendente de aprovação" message
```

### Test 2: Try to Book (Should Fail)
```bash
# 2. Login and get token
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "lapen@test.com", "password": "test123"}'

# 3. Try to book (should fail with 403)
curl -X POST http://localhost:5001/api/public/schedules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "court_id": 1,
    "date": "2025-01-25",
    "start_time": "10:00",
    "player1_name": "Player 1",
    "player2_name": "Player 2",
    "match_type": "Amistoso"
  }'

# Expected: 403 "Sua solicitação está pendente de aprovação"
```

### Test 3: Admin Approval
```bash
# 4. Admin approves (use admin session)
curl -X POST http://localhost:5001/api/admin/lapen-approve/1 \
  --cookie "session=ADMIN_SESSION"

# Expected: Success message
```

### Test 4: Book Successfully
```bash
# 5. Try to book again (should succeed)
curl -X POST http://localhost:5001/api/public/schedules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "court_id": 1,
    "date": "2025-01-25",
    "start_time": "10:00",
    "player1_name": "Player 1",
    "player2_name": "Player 2",
    "match_type": "Amistoso"
  }'

# Expected: Success!
```

## 🔧 Troubleshooting

### Issue: Migration not applied
```bash
# Run migration manually
python3 src/migrations/add_lapen_fields.py up
```

### Issue: User can't book after approval
- Check user status in database:
```sql
SELECT id, email, is_lapen_member, lapen_approved FROM users WHERE email = 'user@example.com';
```
- Ensure both fields are TRUE

### Issue: Admin can't see requests
- Check admin authentication
- Verify endpoint: `/api/admin/lapen-requests?status=pending`
- Check browser console for errors

### Issue: Frontend not showing LAPEN field
- Clear browser cache
- Check if SignUp.jsx was updated
- Verify form state includes `is_lapen_member`

## 📞 Support

For issues or questions:
1. Check `LAPEN_MEMBER_IMPLEMENTATION.md` for details
2. Review error messages in browser console
3. Check backend logs in `logs/` directory
4. Verify database schema with migration script

## ✅ Verification Checklist

- [ ] Migration executed successfully
- [ ] Registration form shows LAPEN field
- [ ] Non-approved users cannot book courts
- [ ] Approved users can book courts
- [ ] Admin panel shows pending requests
- [ ] Approve/Reject buttons work
- [ ] Mobile view works correctly
- [ ] Error messages in Portuguese
- [ ] All users can still place bets
- [ ] Public can view agenda

---

**Implementation Date:** January 2025  
**Version:** 1.0  
**Status:** ✅ Complete
