-- Normalize legacy platform rows (tenantId NULL) to the explicit "platform" scope.
UPDATE `AICredential` SET `tenantId` = 'platform' WHERE `tenantId` IS NULL;

-- Keep one credential per provider and scope before adding the unique index.
DELETE FROM `AICredential`
WHERE `id` NOT IN (
    SELECT `id` FROM (
        SELECT MIN(`id`) AS `id` FROM `AICredential` GROUP BY `tenantId`, `providerId`
    ) AS `keep`
);

ALTER TABLE `AICredential`
    MODIFY COLUMN `tenantId` CHAR(36) NOT NULL DEFAULT 'platform',
    ADD COLUMN `lastFour` VARCHAR(20) NULL,
    ADD COLUMN `enabled` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `AICredential`
    ADD UNIQUE INDEX `AICredential_tenantId_providerId_key` (`tenantId`, `providerId`);
