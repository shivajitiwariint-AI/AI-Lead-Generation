-- Email and phone verification flags for data quality checks.
ALTER TABLE `Lead` ADD COLUMN `emailVerified` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Lead` ADD COLUMN `phoneVerified` BOOLEAN NOT NULL DEFAULT false;

-- Quality-first lead generation: relevance to the customer's services and
-- overall data quality. Both are 0-100 and computed before a lead is created.
ALTER TABLE `Lead` ADD COLUMN `relevanceScore` INT NOT NULL DEFAULT 0;
ALTER TABLE `Lead` ADD COLUMN `dataQualityScore` INT NOT NULL DEFAULT 0;

-- Indexes so the leads list can filter/sort by quality.
CREATE INDEX `Lead_tenantId_relevanceScore_idx` ON `Lead`(`tenantId`, `relevanceScore`);
CREATE INDEX `Lead_tenantId_dataQualityScore_idx` ON `Lead`(`tenantId`, `dataQualityScore`);
