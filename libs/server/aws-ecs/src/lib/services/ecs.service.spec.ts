import { EcsService } from './ecs.service';

describe(EcsService.name, () => {
  describe(EcsService.mapObjectToEcsEnvironmentArray.name, () => {
    it.each([
      [{ hot: "sauce" }],
      [null],
      [{ age: 337 }],
    ])('given "%j", lives up to its name', (_) => {
      expect(EcsService.mapObjectToEcsEnvironmentArray(_)).toMatchSnapshot();
    });
  });
});
