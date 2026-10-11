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
	private static C3DiscoveryUrl = 'https://cnepmob.volvocars.com';
	private static C3DiscoveryAccept = 'application/volvo.cloud.cnepmob.v1+json';

	private channelPromise: Promise<void> | undefined;
	private availabilityClient: ReturnType<typeof createClient<typeof AvailabilityServiceDefinition>> | undefined;
	private batteryClient: ReturnType<typeof createClient<typeof BatteryServiceDefinition>> | undefined;
	private chargeTimerClient: ReturnType<typeof createClient<typeof GlobalChargeTimerServiceDefinition>> | undefined;
	private exteriorClient: ReturnType<typeof createClient<typeof ExteriorServiceDefinition>> | undefined;
	private odometerClient: ReturnType<typeof createClient<typeof OdometerServiceDefinition>> | undefined;
	private parkingClimateTimerClient: ReturnType<typeof createClient<typeof ParkingClimateTimerServiceDefinition>> | undefined;
	private parkingClimatizationClient: ReturnType<typeof createClient<typeof ParkingClimatizationServiceDefinition>> | undefined;

	private async ensureClients(): Promise<void> {
		if (!this.channelPromise) {
			this.channelPromise = this.createClients().catch((error: unknown) => {
				this.channelPromise = undefined;
				throw error;
			});
		}
		await this.channelPromise;
	}

	private async createClients(): Promise<void> {
		const response = await fetch(PolestarGrpc.C3DiscoveryUrl, {
			headers: { Accept: PolestarGrpc.C3DiscoveryAccept }
		});
		if (!response.ok) {
			throw new Error(`C3 endpoint discovery failed with status ${response.status}`);
		}

		const discovery: unknown = await response.json();
		if (
			typeof discovery !== 'object' || discovery === null ||
			!('c3' in discovery) || typeof discovery.c3 !== 'object' || discovery.c3 === null ||
			!('grpcHost' in discovery.c3) || typeof discovery.c3.grpcHost !== 'string' ||
			!('grpcPort' in discovery.c3) || typeof discovery.c3.grpcPort !== 'number' ||
			!Number.isInteger(discovery.c3.grpcPort) || discovery.c3.grpcPort < 1 || discovery.c3.grpcPort > 65535
		) {
			throw new Error('C3 endpoint discovery returned an invalid response');
		}

		const channel = createChannel(`https://${discovery.c3.grpcHost}:${discovery.c3.grpcPort}`);
		this.availabilityClient = createClient(AvailabilityServiceDefinition, channel);
		this.batteryClient = createClient(BatteryServiceDefinition, channel);
		this.chargeTimerClient = createClient(GlobalChargeTimerServiceDefinition, channel);
		this.exteriorClient = createClient(ExteriorServiceDefinition, channel);
		this.odometerClient = createClient(OdometerServiceDefinition, channel);
		this.parkingClimateTimerClient = createClient(ParkingClimateTimerServiceDefinition, channel);
		this.parkingClimatizationClient = createClient(ParkingClimatizationServiceDefinition, channel);
	}

	async getLatestAvailability(token: string, vin: string): Promise<Availability | undefined> {
		await this.ensureClients();
		const result = await this.availabilityClient!.getLatestAvailability({
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
		await this.ensureClients();
		const result = await this.batteryClient!.getLatestBattery({
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
		await this.ensureClients();
		const result = await this.chargeTimerClient!.getGlobalChargeTimerStream({
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
		await this.ensureClients();
		const result = await this.exteriorClient!.getLatestExterior({
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
		await this.ensureClients();
		const result = await this.odometerClient!.getOdometer({
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
		await this.ensureClients();
		const result = await this.parkingClimateTimerClient!.getTimers({
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
		await this.ensureClients();
		const result = await this.parkingClimateTimerClient!.getTimerSettings({
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
		await this.ensureClients();
		const result = await this.parkingClimatizationClient!.getLatestParkingClimatization({
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