import { v4 as uuidV4 } from 'uuid';
import { createChannel, createClient, Metadata } from 'nice-grpc';
import { AvailabilityServiceDefinition, Availability } from './compiled_proto/availability.ts';
import { BatteryServiceDefinition, Battery } from './compiled_proto/battery.ts';
import { GlobalChargeTimerServiceDefinition, GetGlobalChargeTimerResponse } from './compiled_proto/chronos.ts';
import { ExteriorServiceDefinition, Exterior } from './compiled_proto/exterior.ts';
import { OdometerServiceDefinition, GetOdometerResponse } from './compiled_proto/odometer.ts';
import { ParkingClimateTimerServiceDefinition, GetParkingClimateTimersResponse, GetParkingClimateTimerSettingsResponse } from './compiled_proto/parkingclimatetimer.ts';
import { ParkingClimatizationServiceDefinition, ParkingClimatization } from './compiled_proto/parkingclimatization.ts';

class PolestarGrpc {
	private C3Host = 'https://cepmobtoken.eu.prod.c3.volvocars.com';

	private C3Channel = createChannel(this.C3Host);

	private availabilityClient         = createClient(AvailabilityServiceDefinition,         this.C3Channel);
	private batteryClient              = createClient(BatteryServiceDefinition,              this.C3Channel);
	private chargeTimerClient          = createClient(GlobalChargeTimerServiceDefinition,    this.C3Channel);
	private exteriorClient             = createClient(ExteriorServiceDefinition,             this.C3Channel);
	private odometerClient             = createClient(OdometerServiceDefinition,             this.C3Channel);
	private parkingClimateTimerClient  = createClient(ParkingClimateTimerServiceDefinition,  this.C3Channel);
	private parkingClimatizationClient = createClient(ParkingClimatizationServiceDefinition, this.C3Channel);

	async getLatestAvailability(token: string, vin: string): Promise<Availability | undefined> {
		const result = await this.availabilityClient.getLatestAvailability({
			id: uuidV4(),
			vin: vin
		}, {
			metadata: Metadata({
				authorization: token,
				vin: vin
			})
		});

		return result.availability
	}

	async getLatestBattery(token: string, vin: string): Promise<Battery | undefined> {
		const result = await this.batteryClient.getLatestBattery({
			id: uuidV4(),
			vin: vin
		}, {
			metadata: Metadata({
				authorization: token,
				vin: vin
			})
		});

		return result.battery
	}

	async getGlobalChargeTimerStream(token: string, vin: string): Promise<AsyncIterable<GetGlobalChargeTimerResponse> | undefined> {
		const result = await this.chargeTimerClient.getGlobalChargeTimerStream({
			request: {
				id: uuidV4(),
				vin: vin,
				source: 'mobile',
				timeZone: {
					offsetMinutes: 0
				}
			}
		}, {
			metadata: Metadata({
				authorization: token,
				vin: vin
			})
		});

		return result
	}

	async getLatestExterior(token: string, vin: string): Promise<Exterior | undefined> {
		const result = await this.exteriorClient.getLatestExterior({
			id: uuidV4(),
			vin: vin
		}, {
			metadata: Metadata({
				authorization: token,
				vin: vin
			})
		});

		return result.exterior
	}

	async getOdometer(token: string, vin: string): Promise<AsyncIterable<GetOdometerResponse> | undefined> {
		const result = await this.odometerClient.getOdometer({
			id: uuidV4(),
			vin: vin
		}, {
			metadata: Metadata({
				authorization: token,
				vin: vin
			})
		});

		return result;
	}

	async getClimateTimers(token: string, vin: string): Promise<AsyncIterable<GetParkingClimateTimersResponse> | undefined> {
		const result = await this.parkingClimateTimerClient.getTimers({
			request: {
				id: uuidV4(),
				vin: vin,
				source: 'mobile',
				timeZone: {
					offsetMinutes: 0
				}
			}
		}, {
			metadata: Metadata({
				authorization: token,
				vin: vin
			})
		});

		return result;
	}

	async getTimerSettings(token: string, vin: string): Promise<AsyncIterable<GetParkingClimateTimerSettingsResponse> | undefined> {
		const result = await this.parkingClimateTimerClient.getTimerSettings({
			request: {
				id: uuidV4(),
				vin: vin,
				source: 'mobile',
				timeZone: {
					offsetMinutes: 0
				}
			}
		}, {
			metadata: Metadata({
				authorization: token,
				vin: vin
			})
		});

		return result;
	}

	async getLatestParkingClimatization(token: string, vin: string): Promise<ParkingClimatization | undefined> {
		const result = await this.parkingClimatizationClient.getLatestParkingClimatization({
			id: uuidV4(),
			vin: vin,
		}, {
			metadata: Metadata({
				authorization: token,
				vin: vin
			})
		});

		return result.parkingClimatization;
	}
}

export {
	PolestarGrpc
}