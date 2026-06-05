import { VideoComposer } from '../../src/services/VideoComposer';
import { VisualAsset, AudioAsset, AnimationEffect } from '../../src/types';

describe('VideoComposer', () => {
  let composer: VideoComposer;

  beforeEach(() => {
    composer = new VideoComposer();
  });

  test('should compose video from assets', async () => {
    const mockVisualAssets: VisualAsset[] = [
      {
        id: 'frame_1',
        type: 'prop',
        url: 'http://example.com/frame1.jpg',
        description: '第一帧',
        metadata: {}
      }
    ];

    const mockAudioAssets: AudioAsset[] = [
      {
        id: 'dialogue_1',
        type: 'dialogue',
        url: 'http://example.com/audio1.mp3',
        duration: 5.0,
        characterId: 'char_1'
      }
    ];

    const mockAnimations: AnimationEffect[] = [
      {
        id: 'anim_1',
        type: 'zoom',
        startTime: 0,
        duration: 2.0,
        parameters: { scale: 1.2 }
      }
    ];

    const result = await composer.composeVideo({
      visualAssets: mockVisualAssets,
      audioAssets: mockAudioAssets,
      animations: mockAnimations,
      duration: 10.0,
      outputFormat: 'mp4'
    });

    expect(result).toBeDefined();
    expect(result.outputPath).toBeDefined();
    expect(result.duration).toBe(10.0);
  });

  test('should add animation effects', async () => {
    const effect: AnimationEffect = {
      id: 'test_anim',
      type: 'zoom',
      startTime: 0,
      duration: 2.0,
      parameters: { scale: 1.5 }
    };

    const result = await composer.addAnimationEffect('test_video', effect);
    expect(result).toBe(true);
  });

  test('should export video', async () => {
    const result = await composer.exportVideo('test_video', {
      format: 'mp4',
      resolution: '1080p',
      fps: 30,
      quality: 'high',
      outputPath: '/output/video.mp4'
    });

    expect(result).toBeDefined();
    expect(result.outputPath).toBeDefined();
  });
});