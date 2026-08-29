CREATE TABLE `burnInMeasurements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`componentId` int NOT NULL,
	`timeH` int NOT NULL,
	`parameterName` varchar(128) NOT NULL,
	`value` decimal(18,8) NOT NULL,
	`unit` varchar(32) NOT NULL,
	`absoluteLimit` decimal(18,8),
	`measurementUncertainty` decimal(18,8),
	`runId` varchar(128),
	`measuredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `burnInMeasurements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `components` (
	`id` int AUTO_INCREMENT NOT NULL,
	`componentId` varchar(128) NOT NULL,
	`partNumber` varchar(128) NOT NULL,
	`lotId` varchar(128) NOT NULL,
	`testStationId` varchar(128),
	`temperatureC` decimal(8,3),
	`voltageV` decimal(8,3),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `components_id` PRIMARY KEY(`id`),
	CONSTRAINT `components_componentId_unique` UNIQUE(`componentId`)
);
--> statement-breakpoint
CREATE TABLE `qaAuditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`resultId` int,
	`actorUserId` int,
	`eventType` enum('SCREENING_COMPLETED','REVIEWED','RELEASED','REJECTED','HELD') NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qaAuditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `screeningResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`componentId` int NOT NULL,
	`decision` enum('ACCEPT','HOLD','REJECT') NOT NULL,
	`peerMedian24h` decimal(18,8),
	`peerMad24h` decimal(18,8),
	`robustZ24h` decimal(18,8),
	`predicted168h` decimal(18,8),
	`upper168h` decimal(18,8),
	`predictedSlope` decimal(18,8),
	`safetySlope` decimal(18,8),
	`absoluteLimitViolated` int NOT NULL DEFAULT 0,
	`reasonCode` varchar(128) NOT NULL,
	`explanation` text NOT NULL,
	`modelVersion` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `screeningResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `screeningRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runKey` varchar(128) NOT NULL,
	`requestedByUserId` int,
	`parameterName` varchar(128) NOT NULL,
	`status` enum('queued','complete','failed') NOT NULL DEFAULT 'complete',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `screeningRuns_id` PRIMARY KEY(`id`),
	CONSTRAINT `screeningRuns_runKey_unique` UNIQUE(`runKey`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `measurements_component_param_time_idx` ON `burnInMeasurements` (`componentId`,`parameterName`,`timeH`);--> statement-breakpoint
CREATE INDEX `components_lot_part_idx` ON `components` (`lotId`,`partNumber`);--> statement-breakpoint
CREATE INDEX `qa_audit_run_event_idx` ON `qaAuditEvents` (`runId`,`eventType`);--> statement-breakpoint
CREATE INDEX `screening_results_run_decision_idx` ON `screeningResults` (`runId`,`decision`);