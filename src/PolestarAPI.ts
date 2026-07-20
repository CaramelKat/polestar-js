import { gql, GraphQLClient } from 'graphql-request';
import { PolestarAuth } from './PolestarAuth.ts';
import { PolestarGrpc } from './PolestarGrpc.ts';

import type { Car, getConsumerCarsV2 } from './types/queries/getConsumerCarsV2';
import type { getCarImages, Image, ImageAngles } from './types/queries/getCarImages';

import type { ParkingClimatization } from './compiled_proto/parkingclimatization.ts';
import type { GetParkingClimateTimersResponse } from './compiled_proto/parkingclimatetimer.ts';
import type { GetOdometerResponse } from './compiled_proto/odometer.ts';
import type { Exterior } from './compiled_proto/exterior.ts';
import type { GetGlobalChargeTimerResponse } from './compiled_proto/chronos.ts';
import type { Battery } from './compiled_proto/battery.ts';
import type { Availability } from './compiled_proto/availability.ts';

class PolestarAPI {
	protected endpoint_private = 'https://pc-api.polestar.com/eu-north-1/mystar-v2';
	protected endpoint_public = 'https://pc-api.polestar.com/eu-north-1/mystar-public';
	protected polestar_public_api_key = 'da2-js63uvc7c5hwpdudt657d5lyou';

	protected auth: PolestarAuth;
	protected grpc: PolestarGrpc;
	protected client_private = new GraphQLClient(this.endpoint_private, {
		method: 'POST'
	});
	protected client_public = new GraphQLClient(this.endpoint_public, {
		method: 'POST'
	});

	constructor(email: string, password: string) {
		this.auth = new PolestarAuth(email, password);
		this.grpc = new PolestarGrpc();
	}

	async request(query: string, variables: object = {}, private_client: boolean = true) {
		try {
			const client = private_client ? this.client_private : this.client_public;
			return await client.request(query, variables, {
				authorization: await this.auth.getToken(),
				'x-api-key': (private_client ? '' : this.polestar_public_api_key)
			});
		} catch (error: any) {
			console.error(error);
		}
	}

	async getCars(): Promise<getConsumerCarsV2 | undefined> {
		return await this.request(gql`
			query GetConsumerCarsV2($locale: String) {
				getConsumerCarsV2(locale: $locale) {
					vin
					internalVehicleIdentifier
					registrationNo
					market
					originalMarket
					currentPlannedDeliveryDate
					deliveryDate
					edition
					pno34
					modelName
					modelYear
					commercialModelYear
					computedModelYear
					structureWeek
					userIsPrimaryDriver
				}
			}
		`,{
			locale: `en_US`,
		});
	}

	async getCar(vin: string) {
		const cars = await this.getCars();
		if (!cars)
			return;

		return cars.getConsumerCarsV2.find((car) => car.vin == vin);
	}

	async getTelematics(vins: string[]): Promise<any | undefined> {
		return await this.request(gql`
			query CarTelematicsV2($vins: [String!]!) {
				carTelematicsV2(vins: $vins) {
					battery {
						vin
						timestamp {
							seconds
							nanos
						}
						batteryChargeLevelPercentage
						chargingStatusV2
						estimatedChargingTimeToFullMinutes
						estimatedDistanceToEmptyKm
						estimatedDistanceToEmptyMiles
					}
					health {
						vin
						timestamp {
							seconds
							nanos
						}
						daysToService
						distanceToServiceKm
						serviceWarning
						brakeFluidLevelWarning
						engineCoolantLevelWarning
						oilLevelWarning
					}
					odometer {
						vin
						timestamp {
							seconds
							nanos
						}
						odometerMeters
					}
				}
			}
		`,{
			vins: vins,
		});
	}

	async getCarImages(car: Car): Promise<getCarImages> {
		return await this.request(gql`
				query GetCarImages($pno34: String!, $structureWeek: String!, $modelYear: String!, $locale: String) {
					getCarImages(pno34: $pno34 structureWeek: $structureWeek modelYear: $modelYear locale: $locale) {
						transparent {
							url
							angle
							altText
						}
						opaque {
							url
							angle
							altText
						}
					}
				}
			`, {
			pno34: car.pno34,
			structureWeek: car.structureWeek,
			modelYear: car.modelYear,
			locale: 'us'
		}, false)
	}

	async getCarImage(car: Car, type: 'transparent' | 'opaque', angle: ImageAngles): Promise<Image | undefined> {
		const { getCarImages } = await this.getCarImages(car);
		if (!getCarImages) return;

		const images = type == 'transparent' ? getCarImages.transparent : getCarImages.opaque;

		return images.find((image) => image.angle == angle )
	}

	async getLatestAvailability(car: Car): Promise<Availability | undefined> {
		const token = await this.auth.getToken();
		return await this.grpc.getLatestAvailability(token, car.vin);
	}

	async getLatestBattery(car: Car): Promise<Battery | undefined> {
		const token = await this.auth.getToken();
		return await this.grpc.getLatestBattery(token, car.vin);
	}

	async getGlobalChargeTimerStream(car: Car): Promise<AsyncIterable<GetGlobalChargeTimerResponse> | undefined> {
		const token = await this.auth.getToken();
		return await this.grpc.getGlobalChargeTimerStream(token, car.vin);
	}

	async getLatestExterior(car: Car): Promise<Exterior | undefined> {
		const token = await this.auth.getToken();
		return await this.grpc.getLatestExterior(token, car.vin);
	}

	async getOdometer(car: Car): Promise<AsyncIterable<GetOdometerResponse> | undefined> {
		const token = await this.auth.getToken();
		return await this.grpc.getOdometer(token, car.vin);
	}

	async getClimateTimers(car: Car): Promise<AsyncIterable<GetParkingClimateTimersResponse> | undefined> {
		const token = await this.auth.getToken();
		return await this.grpc.getClimateTimers(token, car.vin);
	}

	async getTimerSettings(car: Car): Promise<AsyncIterable<GetParkingClimateTimersResponse> | undefined> {
		const token = await this.auth.getToken();
		return await this.grpc.getClimateTimers(token, car.vin);
	}

	async getLatestParkingClimatization(car: Car): Promise<ParkingClimatization | undefined> {
		const token = await this.auth.getToken();
		return await this.grpc.getLatestParkingClimatization(token, car.vin);
	}

}

export {
	PolestarAPI
}