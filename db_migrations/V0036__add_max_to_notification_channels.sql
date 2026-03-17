ALTER TABLE notification_channels DROP CONSTRAINT IF EXISTS notification_channels_channel_check;
ALTER TABLE notification_channels ADD CONSTRAINT notification_channels_channel_check CHECK (channel IN ('push','telegram','email','max'));

ALTER TABLE notification_history DROP CONSTRAINT IF EXISTS notification_history_channel_check;
ALTER TABLE notification_history ADD CONSTRAINT notification_history_channel_check CHECK (channel IN ('push','telegram','email','max'));

INSERT INTO notification_channels (channel, enabled, settings) VALUES ('max', false, '{}');