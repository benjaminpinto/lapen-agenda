export const testUsers = {
  regular: {
    email: 'test.user@example.com',
    password: 'Test123!',
    name: 'Test User',
    phone: '11999999999',
    pix_key: 'test@example.com'
  },
  lapenMember: {
    email: 'lapen.member@example.com',
    password: 'Lapen123!',
    name: 'LAPEN Member',
    phone: '11988888888',
    pix_key: 'lapen@example.com',
    is_lapen_member: true
  }
};

export const testAdmin = {
  password: process.env.ADMIN_PASSWORD
};

export const testMatch = {
  player1: 'João Silva',
  player2: 'Pedro Santos',
  court: 'Quadra 1',
  date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
  time: '14:00'
};

export const testBet = {
  amount: '50.00',
  minAmount: '1.00',
  maxAmount: '1000.00'
};
