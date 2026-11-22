-- Verified state for leads. Existing rows remain unverified until reviewed.
ALTER TABLE `Lead` ADD COLUMN `verified` BOOLEAN NOT NULL DEFAULT false;

-- Public social posts/videos discovered via official APIs or added by a human.
CREATE TABLE `SocialSignal` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `platform` VARCHAR(50) NOT NULL,
    `kind` VARCHAR(50) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `author` VARCHAR(200) NULL,
    `authorHandle` VARCHAR(200) NULL,
    `externalId` VARCHAR(255) NULL,
    `publishedAt` DATETIME(3) NULL,
    `views` INT NULL,
    `likes` INT NULL,
    `comments` INT NULL,
    `shares` INT NULL,
    `durationSec` INT NULL,
    `thumbnailUrl` VARCHAR(500) NULL,
    `snippet` TEXT NULL,
    `relevanceScore` INT NOT NULL DEFAULT 0,
    `status` VARCHAR(50) NOT NULL DEFAULT 'new',
    `leadId` CHAR(36) NULL,
    `sourceQuery` VARCHAR(300) NULL,
    `discoveredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SocialSignal_tenantId_platform_externalId_key` (`tenantId`, `platform`, `externalId`),
    INDEX `SocialSignal_tenantId_status_idx` (`tenantId`, `status`),
    INDEX `SocialSignal_tenantId_platform_publishedAt_idx` (`tenantId`, `platform`, `publishedAt`),
    INDEX `SocialSignal_tenantId_relevanceScore_idx` (`tenantId`, `relevanceScore`),
    INDEX `SocialSignal_leadId_idx` (`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Encrypted settings for official Meta / LinkedIn / Instagram lead forms.
CREATE TABLE `SocialCampaignSource` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `platform` VARCHAR(50) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `externalAccountId` VARCHAR(200) NULL,
    `formIds` JSON NULL,
    `encryptedAppSecret` TEXT NULL,
    `encryptedAccessToken` TEXT NULL,
    `encryptedVerifyToken` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SocialCampaignSource_tenantId_platform_externalAccountId_key` (`tenantId`, `platform`, `externalAccountId`),
    INDEX `SocialCampaignSource_tenantId_idx` (`tenantId`),
    INDEX `SocialCampaignSource_platform_externalAccountId_idx` (`platform`, `externalAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
