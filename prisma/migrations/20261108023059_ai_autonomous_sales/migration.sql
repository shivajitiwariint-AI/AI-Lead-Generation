-- AlterTable
ALTER TABLE `auditlog` ADD COLUMN `actorType` VARCHAR(20) NOT NULL DEFAULT 'user',
    ADD COLUMN `category` VARCHAR(50) NOT NULL DEFAULT 'general';

-- AlterTable
ALTER TABLE `lead` ADD COLUMN `controlMode` VARCHAR(20) NOT NULL DEFAULT 'ai',
    ADD COLUMN `lastAiActionAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `leadqualificationresult` ADD COLUMN `matchScore` INTEGER NULL,
    ADD COLUMN `matchedOffers` JSON NULL;

-- AlterTable
ALTER TABLE `message` ADD COLUMN `body` TEXT NULL,
    ADD COLUMN `direction` VARCHAR(20) NOT NULL DEFAULT 'outbound',
    ADD COLUMN `fromAddress` VARCHAR(255) NULL,
    ADD COLUMN `generatedBy` VARCHAR(20) NOT NULL DEFAULT 'manual',
    ADD COLUMN `meta` JSON NULL,
    ADD COLUMN `rejectedAt` DATETIME(3) NULL,
    ADD COLUMN `rejectedBy` CHAR(36) NULL,
    ADD COLUMN `rejectionReason` VARCHAR(500) NULL,
    ADD COLUMN `scheduledAt` DATETIME(3) NULL,
    ADD COLUMN `sentAt` DATETIME(3) NULL,
    ADD COLUMN `subject` VARCHAR(500) NULL,
    ADD COLUMN `toAddress` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `tenant` ADD COLUMN `automationPaused` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `operatingMode` ENUM('FULLY_AI_AUTOMATED', 'AI_WITH_APPROVAL', 'FULLY_MANUAL') NOT NULL DEFAULT 'AI_WITH_APPROVAL';

-- CreateTable
CREATE TABLE `CompanyProfile` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `industry` VARCHAR(100) NULL,
    `website` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `products` JSON NULL,
    `services` JSON NULL,
    `properties` JSON NULL,
    `salesObjectives` JSON NULL,
    `targetMarket` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompanyProfile_tenantId_key`(`tenantId`),
    INDEX `CompanyProfile_industry_idx`(`industry`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResearchSource` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `sourceType` VARCHAR(50) NOT NULL,
    `url` VARCHAR(500) NULL,
    `approved` BOOLEAN NOT NULL DEFAULT true,
    `config` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ResearchSource_tenantId_idx`(`tenantId`),
    INDEX `ResearchSource_tenantId_approved_idx`(`tenantId`, `approved`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResearchRun` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `sourceId` CHAR(36) NULL,
    `query` VARCHAR(500) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `criteria` JSON NULL,
    `results` JSON NULL,
    `foundCount` INTEGER NOT NULL DEFAULT 0,
    `createdCount` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ResearchRun_tenantId_idx`(`tenantId`),
    INDEX `ResearchRun_status_idx`(`status`),
    INDEX `ResearchRun_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalItem` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `itemType` VARCHAR(50) NOT NULL,
    `itemRefId` CHAR(36) NULL,
    `title` VARCHAR(300) NOT NULL,
    `summary` TEXT NULL,
    `payload` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `decidedBy` CHAR(36) NULL,
    `decidedAt` DATETIME(3) NULL,
    `decisionNote` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ApprovalItem_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `ApprovalItem_itemType_idx`(`itemType`),
    INDEX `ApprovalItem_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentRun` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `trigger` VARCHAR(30) NOT NULL DEFAULT 'manual',
    `mode` VARCHAR(30) NOT NULL DEFAULT 'AI_WITH_APPROVAL',
    `status` VARCHAR(20) NOT NULL DEFAULT 'running',
    `leadId` CHAR(36) NULL,
    `steps` JSON NULL,
    `summary` TEXT NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgentRun_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `AgentRun_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Meeting` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    `notes` TEXT NULL,
    `createdBy` VARCHAR(20) NOT NULL DEFAULT 'manual',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Meeting_tenantId_idx`(`tenantId`),
    INDEX `Meeting_leadId_idx`(`leadId`),
    INDEX `Meeting_tenantId_startsAt_idx`(`tenantId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIBudget` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NULL,
    `monthlyTokenLimit` INTEGER NULL,
    `monthlyCostLimit` DECIMAL(10, 4) NULL,
    `alertThreshold` DOUBLE NOT NULL DEFAULT 0.8,
    `enforce` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AIBudget_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_createdAt_idx` ON `AuditLog`(`tenantId`, `createdAt`);

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_category_idx` ON `AuditLog`(`tenantId`, `category`);

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_actorType_idx` ON `AuditLog`(`tenantId`, `actorType`);

-- CreateIndex
CREATE INDEX `Lead_tenantId_controlMode_idx` ON `Lead`(`tenantId`, `controlMode`);

-- CreateIndex
CREATE INDEX `Message_tenantId_status_idx` ON `Message`(`tenantId`, `status`);

-- CreateIndex
CREATE INDEX `Message_tenantId_createdAt_idx` ON `Message`(`tenantId`, `createdAt`);
