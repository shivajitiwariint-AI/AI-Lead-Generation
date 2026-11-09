-- CreateTable
CREATE TABLE `Tenant` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL') NOT NULL DEFAULT 'ACTIVE',
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'UTC',
    `planId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tenant_slug_key`(`slug`),
    INDEX `Tenant_slug_idx`(`slug`),
    INDEX `Tenant_status_idx`(`status`),
    INDEX `Tenant_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(200) NULL,
    `email` VARCHAR(255) NOT NULL,
    `emailVerified` DATETIME(3) NULL,
    `image` VARCHAR(500) NULL,
    `password` VARCHAR(255) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION') NOT NULL DEFAULT 'PENDING_VERIFICATION',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantUser` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `roleId` CHAR(36) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TenantUser_tenantId_idx`(`tenantId`),
    INDEX `TenantUser_userId_idx`(`userId`),
    INDEX `TenantUser_roleId_idx`(`roleId`),
    UNIQUE INDEX `TenantUser_tenantId_userId_key`(`tenantId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('SUPER_ADMIN', 'COMPANY_OWNER', 'COMPANY_ADMIN', 'SALES_MANAGER', 'SALES_REPRESENTATIVE', 'READ_ONLY_ANALYST') NOT NULL DEFAULT 'SALES_REPRESENTATIVE',
    `description` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Role_tenantId_idx`(`tenantId`),
    INDEX `Role_type_idx`(`type`),
    UNIQUE INDEX `Role_tenantId_type_key`(`tenantId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Permission_key_key`(`key`),
    INDEX `Permission_key_idx`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `id` CHAR(36) NOT NULL,
    `roleId` CHAR(36) NOT NULL,
    `permissionId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RolePermission_roleId_idx`(`roleId`),
    INDEX `RolePermission_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `RolePermission_roleId_permissionId_key`(`roleId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `limits` JSON NOT NULL,
    `features` JSON NOT NULL,
    `priceMonthly` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Plan_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `planId` CHAR(36) NOT NULL,
    `status` ENUM('ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED', 'TRIALING') NOT NULL DEFAULT 'TRIALING',
    `currentPeriodStart` DATETIME(3) NOT NULL,
    `currentPeriodEnd` DATETIME(3) NOT NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Subscription_tenantId_idx`(`tenantId`),
    INDEX `Subscription_planId_idx`(`planId`),
    INDEX `Subscription_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Account` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `provider` VARCHAR(100) NOT NULL,
    `providerAccountId` VARCHAR(255) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(50) NULL,
    `scope` TEXT NULL,
    `id_token` TEXT NULL,
    `session_state` TEXT NULL,

    INDEX `Account_userId_idx`(`userId`),
    UNIQUE INDEX `Account_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` CHAR(36) NOT NULL,
    `sessionToken` VARCHAR(255) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_sessionToken_key`(`sessionToken`),
    INDEX `Session_sessionToken_idx`(`sessionToken`),
    INDEX `Session_userId_idx`(`userId`),
    INDEX `Session_expires_idx`(`expires`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationToken` (
    `identifier` VARCHAR(255) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VerificationToken_token_key`(`token`),
    INDEX `VerificationToken_expires_idx`(`expires`),
    UNIQUE INDEX `VerificationToken_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `sourceId` CHAR(36) NULL,
    `ownerId` CHAR(36) NULL,
    `name` VARCHAR(200) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `company` VARCHAR(200) NULL,
    `website` VARCHAR(500) NULL,
    `industry` VARCHAR(100) NULL,
    `location` VARCHAR(200) NULL,
    `requirement` TEXT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'new',
    `score` INTEGER NOT NULL DEFAULT 0,
    `aiSummary` TEXT NULL,
    `consentMarketing` BOOLEAN NOT NULL DEFAULT false,
    `consentCapturedAt` DATETIME(3) NULL,
    `consentMethod` VARCHAR(100) NULL,
    `lastContactedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Lead_tenantId_idx`(`tenantId`),
    INDEX `Lead_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `Lead_tenantId_ownerId_idx`(`tenantId`, `ownerId`),
    INDEX `Lead_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `Lead_email_idx`(`email`),
    INDEX `Lead_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadSource` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `sourceType` VARCHAR(100) NOT NULL,
    `externalId` VARCHAR(255) NULL,
    `attribution` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadSource_tenantId_idx`(`tenantId`),
    INDEX `LeadSource_leadId_idx`(`leadId`),
    INDEX `LeadSource_sourceType_externalId_idx`(`sourceType`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `industryId` CHAR(36) NULL,
    `scoringProfileId` CHAR(36) NULL,
    `name` VARCHAR(200) NOT NULL,
    `objective` TEXT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
    `category` VARCHAR(100) NULL,
    `targetAudience` VARCHAR(200) NULL,
    `locations` JSON NULL,
    `settings` JSON NULL,
    `schedule` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Campaign_tenantId_idx`(`tenantId`),
    INDEX `Campaign_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `Campaign_industryId_idx`(`industryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignLead` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `campaignId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'new',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CampaignLead_tenantId_idx`(`tenantId`),
    INDEX `CampaignLead_campaignId_idx`(`campaignId`),
    INDEX `CampaignLead_leadId_idx`(`leadId`),
    UNIQUE INDEX `CampaignLead_campaignId_leadId_key`(`campaignId`, `leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadActivity` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `actorId` CHAR(36) NULL,
    `activityType` VARCHAR(100) NOT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadActivity_tenantId_idx`(`tenantId`),
    INDEX `LeadActivity_leadId_idx`(`leadId`),
    INDEX `LeadActivity_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadRequirementValue` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `campaignId` CHAR(36) NOT NULL,
    `fieldKey` VARCHAR(100) NOT NULL,
    `valueJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LeadRequirementValue_tenantId_idx`(`tenantId`),
    INDEX `LeadRequirementValue_campaignId_idx`(`campaignId`),
    UNIQUE INDEX `LeadRequirementValue_leadId_campaignId_fieldKey_key`(`leadId`, `campaignId`, `fieldKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Industry` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `templateVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Industry_key_key`(`key`),
    INDEX `Industry_key_idx`(`key`),
    INDEX `Industry_enabled_idx`(`enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IndustryTemplate` (
    `id` CHAR(36) NOT NULL,
    `industryId` CHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `defaultFields` JSON NULL,
    `defaultQuestions` JSON NULL,
    `scoringProfile` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IndustryTemplate_industryId_idx`(`industryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignFieldDefinition` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `campaignId` CHAR(36) NULL,
    `fieldKey` VARCHAR(100) NOT NULL,
    `label` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `dataType` VARCHAR(50) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `validationRules` JSON NULL,
    `options` JSON NULL,
    `visibleToSales` BOOLEAN NOT NULL DEFAULT true,
    `internalOnly` BOOLEAN NOT NULL DEFAULT false,
    `isSensitive` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CampaignFieldDefinition_tenantId_idx`(`tenantId`),
    INDEX `CampaignFieldDefinition_campaignId_idx`(`campaignId`),
    INDEX `CampaignFieldDefinition_fieldKey_idx`(`fieldKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadQualificationResult` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `campaignId` CHAR(36) NOT NULL,
    `fitScore` INTEGER NOT NULL DEFAULT 0,
    `intentScore` INTEGER NOT NULL DEFAULT 0,
    `urgencyScore` INTEGER NOT NULL DEFAULT 0,
    `completenessScore` INTEGER NOT NULL DEFAULT 0,
    `summary` TEXT NULL,
    `evidence` JSON NULL,
    `nextAction` TEXT NULL,
    `modelId` CHAR(36) NULL,
    `promptVersion` VARCHAR(100) NULL,
    `confidence` VARCHAR(50) NULL,
    `tokenUsage` INTEGER NULL DEFAULT 0,
    `estimatedCost` DECIMAL(10, 4) NULL DEFAULT 0,
    `processingStatus` VARCHAR(50) NOT NULL DEFAULT 'completed',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadQualificationResult_tenantId_idx`(`tenantId`),
    INDEX `LeadQualificationResult_leadId_idx`(`leadId`),
    INDEX `LeadQualificationResult_campaignId_idx`(`campaignId`),
    INDEX `LeadQualificationResult_processingStatus_idx`(`processingStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIProvider` (
    `id` CHAR(36) NOT NULL,
    `providerKey` VARCHAR(100) NOT NULL,
    `displayName` VARCHAR(200) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AIProvider_providerKey_key`(`providerKey`),
    INDEX `AIProvider_providerKey_idx`(`providerKey`),
    INDEX `AIProvider_enabled_idx`(`enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIModel` (
    `id` CHAR(36) NOT NULL,
    `providerId` CHAR(36) NOT NULL,
    `modelKey` VARCHAR(200) NOT NULL,
    `displayName` VARCHAR(200) NOT NULL,
    `capabilities` JSON NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AIModel_providerId_idx`(`providerId`),
    INDEX `AIModel_modelKey_idx`(`modelKey`),
    INDEX `AIModel_enabled_idx`(`enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AICredential` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NULL,
    `providerId` CHAR(36) NOT NULL,
    `encryptedSecret` TEXT NOT NULL,
    `keyVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AICredential_tenantId_idx`(`tenantId`),
    INDEX `AICredential_providerId_idx`(`providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIModuleAssignment` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NULL,
    `moduleKey` VARCHAR(100) NOT NULL,
    `modelId` CHAR(36) NOT NULL,
    `fallbackModelId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AIModuleAssignment_tenantId_idx`(`tenantId`),
    INDEX `AIModuleAssignment_moduleKey_idx`(`moduleKey`),
    UNIQUE INDEX `AIModuleAssignment_tenantId_moduleKey_key`(`tenantId`, `moduleKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIUsageLog` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `providerId` CHAR(36) NOT NULL,
    `modelId` CHAR(36) NOT NULL,
    `inputTokens` INTEGER NOT NULL DEFAULT 0,
    `outputTokens` INTEGER NOT NULL DEFAULT 0,
    `requestId` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AIUsageLog_tenantId_idx`(`tenantId`),
    INDEX `AIUsageLog_providerId_idx`(`providerId`),
    INDEX `AIUsageLog_modelId_idx`(`modelId`),
    INDEX `AIUsageLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AICostLog` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `providerId` CHAR(36) NOT NULL,
    `modelId` CHAR(36) NOT NULL,
    `estimatedCost` DECIMAL(10, 4) NOT NULL DEFAULT 0,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AICostLog_tenantId_idx`(`tenantId`),
    INDEX `AICostLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Chatbot` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `publicKey` VARCHAR(100) NOT NULL,
    `settings` JSON NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Chatbot_publicKey_key`(`publicKey`),
    INDEX `Chatbot_tenantId_idx`(`tenantId`),
    INDEX `Chatbot_publicKey_idx`(`publicKey`),
    INDEX `Chatbot_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `chatbotId` CHAR(36) NULL,
    `leadId` CHAR(36) NULL,
    `visitorRef` VARCHAR(255) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'open',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Conversation_tenantId_idx`(`tenantId`),
    INDEX `Conversation_chatbotId_idx`(`chatbotId`),
    INDEX `Conversation_leadId_idx`(`leadId`),
    INDEX `Conversation_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `conversationId` CHAR(36) NOT NULL,
    `role` VARCHAR(50) NOT NULL,
    `content` TEXT NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatMessage_tenantId_idx`(`tenantId`),
    INDEX `ChatMessage_conversationId_idx`(`conversationId`),
    INDEX `ChatMessage_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeDocument` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `chatbotId` CHAR(36) NOT NULL,
    `fileRef` VARCHAR(500) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'processing',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeDocument_tenantId_idx`(`tenantId`),
    INDEX `KnowledgeDocument_chatbotId_idx`(`chatbotId`),
    INDEX `KnowledgeDocument_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeChunk` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `documentId` CHAR(36) NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `embeddingRef` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KnowledgeChunk_tenantId_idx`(`tenantId`),
    INDEX `KnowledgeChunk_documentId_idx`(`documentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessageTemplate` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `campaignId` CHAR(36) NULL,
    `channel` VARCHAR(50) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `content` TEXT NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MessageTemplate_tenantId_idx`(`tenantId`),
    INDEX `MessageTemplate_channel_idx`(`channel`),
    INDEX `MessageTemplate_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NULL,
    `conversationId` CHAR(36) NULL,
    `channel` VARCHAR(50) NOT NULL,
    `providerId` CHAR(36) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
    `approvedBy` CHAR(36) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Message_tenantId_idx`(`tenantId`),
    INDEX `Message_leadId_idx`(`leadId`),
    INDEX `Message_channel_idx`(`channel`),
    INDEX `Message_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FollowupTask` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `idempotencyKey` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FollowupTask_idempotencyKey_key`(`idempotencyKey`),
    INDEX `FollowupTask_tenantId_idx`(`tenantId`),
    INDEX `FollowupTask_leadId_idx`(`leadId`),
    INDEX `FollowupTask_dueAt_status_idx`(`dueAt`, `status`),
    INDEX `FollowupTask_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsentRecord` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `purpose` VARCHAR(100) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'granted',
    `capturedAt` DATETIME(3) NOT NULL,
    `source` VARCHAR(100) NULL,
    `policyVersion` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConsentRecord_tenantId_idx`(`tenantId`),
    INDEX `ConsentRecord_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SuppressionEntry` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `contactHash` VARCHAR(255) NOT NULL,
    `channel` VARCHAR(50) NOT NULL,
    `reason` VARCHAR(200) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SuppressionEntry_contactHash_key`(`contactHash`),
    INDEX `SuppressionEntry_tenantId_idx`(`tenantId`),
    INDEX `SuppressionEntry_contactHash_idx`(`contactHash`),
    INDEX `SuppressionEntry_channel_idx`(`channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Integration` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `provider` VARCHAR(100) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'disconnected',
    `configRef` TEXT NULL,
    `lastSyncAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Integration_tenantId_idx`(`tenantId`),
    INDEX `Integration_provider_idx`(`provider`),
    INDEX `Integration_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationJob` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `jobType` VARCHAR(100) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `runAt` DATETIME(3) NOT NULL,
    `payload` JSON NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AutomationJob_tenantId_idx`(`tenantId`),
    INDEX `AutomationJob_jobType_status_idx`(`jobType`, `status`),
    INDEX `AutomationJob_runAt_status_idx`(`runAt`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OutboxEvent` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `eventType` VARCHAR(100) NOT NULL,
    `payload` JSON NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OutboxEvent_tenantId_idx`(`tenantId`),
    INDEX `OutboxEvent_eventType_idx`(`eventType`),
    INDEX `OutboxEvent_publishedAt_idx`(`publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookEvent` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `provider` VARCHAR(100) NOT NULL,
    `externalEventId` VARCHAR(255) NOT NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WebhookEvent_externalEventId_key`(`externalEventId`),
    INDEX `WebhookEvent_tenantId_idx`(`tenantId`),
    INDEX `WebhookEvent_provider_idx`(`provider`),
    INDEX `WebhookEvent_externalEventId_idx`(`externalEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NULL,
    `actorId` CHAR(36) NULL,
    `action` VARCHAR(200) NOT NULL,
    `targetType` VARCHAR(100) NULL,
    `targetId` CHAR(36) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_tenantId_idx`(`tenantId`),
    INDEX `AuditLog_actorId_idx`(`actorId`),
    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileAsset` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `storageKey` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `checksum` VARCHAR(128) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FileAsset_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScoringProfile` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `fitScoreWeight` INTEGER NOT NULL DEFAULT 30,
    `intentScoreWeight` INTEGER NOT NULL DEFAULT 25,
    `budgetScoreWeight` INTEGER NOT NULL DEFAULT 20,
    `companyFitWeight` INTEGER NOT NULL DEFAULT 15,
    `contactCompletenessWeight` INTEGER NOT NULL DEFAULT 10,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScoringProfile_tenantId_idx`(`tenantId`),
    INDEX `ScoringProfile_isDefault_idx`(`isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
