
UPDATE push_subscriptions SET user_agent = 'reset' WHERE user_agent IN ('expired', 'unsubscribed');
