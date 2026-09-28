import { YoutubeChannelsController } from './youtube-channels.controller';
import * as search from './youtube-search.util';

function makeConfig(values: Record<string, string> = {}) {
  return { get: jest.fn((key: string) => values[key]) } as any;
}

describe('YoutubeChannelsController', () => {
  it('returns [] without calling the API when YOUTUBE_API_KEY is not configured', async () => {
    const spy = jest.spyOn(search, 'searchChannels');
    const ctrl = new YoutubeChannelsController(makeConfig());
    expect(await ctrl.channels('david')).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('delegates to searchChannels with the configured key and sane defaults', async () => {
    const spy = jest.spyOn(search, 'searchChannels').mockResolvedValue([{ value: '@x', label: 'X', subscribers: 1 }]);
    const ctrl = new YoutubeChannelsController(makeConfig({ YOUTUBE_API_KEY: 'k' }));
    const out = await ctrl.channels('david', '3');
    expect(spy).toHaveBeenCalledWith('david', 'k', 3);
    expect(out).toEqual([{ value: '@x', label: 'X', subscribers: 1 }]);
  });

  it('swallows a failed search into an empty list instead of a 500', async () => {
    jest.spyOn(search, 'searchChannels').mockRejectedValue(new Error('quota'));
    const ctrl = new YoutubeChannelsController(makeConfig({ YOUTUBE_API_KEY: 'k' }));
    expect(await ctrl.channels('david')).toEqual([]);
  });
});
