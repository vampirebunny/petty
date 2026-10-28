import { planIapEvent, productCandidates } from '../../../supabase/functions/_shared/iapEvent';

const userId = '11111111-1111-4111-8111-111111111111';

function body(event: Record<string, unknown>) {
  return { api_version: '1.0', event };
}

it('plans a consumable purchase from the store transaction id', () => {
  const planned = planIapEvent(
    body({
      id: 'evt_1',
      type: 'NON_RENEWING_PURCHASE',
      app_user_id: userId,
      product_id: 'boops_600',
      transaction_id: 'GPA.1',
      environment: 'SANDBOX',
    }),
  );
  expect(planned.eventId).toBe('evt_1');
  expect(planned.plan).toEqual({
    action: 'credit',
    reason: 'iap_purchase',
    transactionId: 'GPA.1',
    productId: 'boops_600',
    userIds: [userId],
    environment: 'SANDBOX',
  });
});

it('ignores test and transfer events and retries a purchase with no player', () => {
  expect(planIapEvent(body({ id: 'evt_test', type: 'TEST' })).plan).toEqual({ action: 'ignore' });
  expect(planIapEvent(body({ id: 'evt_move', type: 'TRANSFER', transaction_id: 'GPA.9' })).plan).toEqual({
    action: 'ignore',
  });
  expect(
    planIapEvent(
      body({
        id: 'evt_guest',
        type: 'NON_RENEWING_PURCHASE',
        app_user_id: 'install-id',
        product_id: 'boops_600',
        transaction_id: 'GPA.2',
      }),
    ).plan.action,
  ).toBe('retry');
});

it('plans a refund from the same transaction and keeps an aliased account id', () => {
  const accountId = '22222222-2222-4222-8222-222222222222';
  const planned = planIapEvent(
    body({
      id: 'evt_refund',
      type: 'CANCELLATION',
      app_user_id: 'install-id',
      aliases: [accountId],
      transaction_id: 'GPA.1',
    }),
  );
  expect(planned.plan).toMatchObject({
    action: 'credit',
    reason: 'iap_refund',
    transactionId: 'GPA.1',
    userIds: [accountId],
  });
  expect(productCandidates('boops_3500:base')).toEqual(['boops_3500:base', 'boops_3500']);
});
