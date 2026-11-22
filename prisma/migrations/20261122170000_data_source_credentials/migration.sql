-- CreateTable
CREATE TABLE `DataSourceCredential` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL DEFAULT 'platform',
    `providerKey` VARCHAR(50) NOT NULL,
    `encryptedSecret` TEXT NOT NULL,
    `encryptedSecondary` TEXT NULL,
    `keyVersion` INTEGER NOT NULL DEFAULT 1,
    `lastFour` VARCHAR(20) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DataSourceCredential_tenantId_providerKey_key`(`tenantId`, `providerKey`),
    INDEX `DataSourceCredential_providerKey_idx`(`providerKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
