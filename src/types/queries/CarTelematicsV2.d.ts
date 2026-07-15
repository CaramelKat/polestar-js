import type { Timestamp } from './common.ts';

export type BatteryStatus = {
	"vin": string;
	"timestamp": Timestamp;
	"batteryChargeLevelPercentage": number;
	"chargingStatusV2": "CHARGING_STATUS_V2_DONE" | "CHARGING_STATUS_V2_IDLE";
	"estimatedChargingTimeToFullMinutes": number;
	"estimatedDistanceToEmptyKm": number;
	"estimatedDistanceToEmptyMiles": number;
}

export type Health = {
	"vin": string;
	"timestamp": Timestamp;
	"daysToService": number;
	"distanceToServiceKm": number;
	"serviceWarning": string;
	"brakeFluidLevelWarning": string;
	"engineCoolantLevelWarning": string;
	"oilLevelWarning": string;
}

export type Odometer = {
	"vin": string;
	"timestamp": Timestamp;
	"odometerMeters": number;
}

export type CarTelematicsV2 = {
	carTelematicsV2: {
		"battery": BatteryStatus[];
		"health": Health[];
		"odometer": Odometer[];
	}
}