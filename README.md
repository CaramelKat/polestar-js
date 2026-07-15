# Polestar-JS

A very WIP port of the Polestar API to ts/js. Lots of implementation details are borrowed from [NorthStar.Api](https://github.com/Greg-Boyles/NorthStar.Api)

## Usage

```ts
const api = new PolestarAPI('example@example.com', 'AccountPassword');

const car = await api.getCar('17CharacterVinNum')
```

## License

This is an unofficial API proxy. Polestar and Volvo trademarks belong to their respective owners.