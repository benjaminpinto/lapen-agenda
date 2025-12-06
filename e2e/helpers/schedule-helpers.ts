import { APIRequestContext } from '@playwright/test';

export async function createScheduleViaAPI(
  request: APIRequestContext,
  token: string,
  scheduleData: {
    court_id: number;
    date: string;
    start_time: string;
    player1_name: string;
    player2_name: string;
    match_type: string;
  }
) {
  const response = await request.post('/api/public/schedules', {
    headers: { 'Authorization': `Bearer ${token}` },
    data: scheduleData
  });
  
  const data = await response.json();
  return { success: response.ok(), data };
}

export async function createMatchViaAPI(
  request: APIRequestContext,
  token: string,
  scheduleId: number,
  bettingEnabled: boolean = true
) {
  const response = await request.post('/api/matches/create', {
    headers: { 'Authorization': `Bearer ${token}` },
    data: { schedule_id: scheduleId, betting_enabled: bettingEnabled }
  });
  
  const data = await response.json();
  return { success: response.ok(), data, matchId: data.match_id };
}

export async function approveLapenMember(
  request: APIRequestContext,
  email: string
) {
  const response = await request.post('/api/admin/lapen-approvals/approve', {
    data: { email }
  });
  
  return { success: response.ok() };
}

export function getFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

export async function placeBetViaAPI(
  request: APIRequestContext,
  token: string,
  betData: {
    schedule_id: number;
    player_name: string;
    amount: string;
    payment_method?: string;
  }
) {
  // Create payment intent
  const paymentResponse = await request.post('/api/betting/create-payment-intent', {
    headers: { 'Authorization': `Bearer ${token}` },
    data: {
      ...betData,
      payment_method: betData.payment_method || 'pix',
      device_id: 'test-device'
    }
  });

  if (!paymentResponse.ok()) {
    return { success: false, error: 'Payment intent creation failed' };
  }

  const paymentData = await paymentResponse.json();

  // Place bet
  const betResponse = await request.post('/api/betting/place-bet', {
    headers: { 'Authorization': `Bearer ${token}` },
    data: {
      schedule_id: betData.schedule_id,
      player_name: betData.player_name,
      amount: betData.amount,
      payment_intent_id: paymentData.payment_id || 'test-payment-id',
      payment_method: betData.payment_method || 'pix'
    }
  });

  const betResult = await betResponse.json();
  return { success: betResponse.ok(), data: betResult };
}
