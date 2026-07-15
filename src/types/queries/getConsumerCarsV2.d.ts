export type Car = {
	vin: string;
	internalVehicleIdentifier: string;
	registrationNo: number | null;
	market: string;
	originalMarket: string;
	currentPlannedDeliveryDate: string;
	deliveryDate: string;
	edition: string;
	pno34: string;
	modelName: string;
	modelYear: string;
	commercialModelYear: string;
	computedModelYear: string;
	structureWeek: string;
	userIsPrimaryDriver: false;
}

export type getConsumerCarsV2 = {
	getConsumerCarsV2: [Car]
}