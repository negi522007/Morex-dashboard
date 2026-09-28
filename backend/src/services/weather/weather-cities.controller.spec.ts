import { WeatherCitiesController } from './weather-cities.controller';
import * as provider from './weather.provider';

describe('WeatherCitiesController', () => {
  it('delegates to searchCities with sane defaults and caps the query length', () => {
    const spy = jest.spyOn(provider, 'searchCities').mockResolvedValue([]);
    const ctrl = new WeatherCitiesController();
    ctrl.cities('x'.repeat(200), 'fr', '3');
    expect(spy).toHaveBeenCalledWith('x'.repeat(80), 'fr', 3);
    ctrl.cities(undefined, undefined, undefined);
    expect(spy).toHaveBeenLastCalledWith('', 'en', 8);
  });
});
