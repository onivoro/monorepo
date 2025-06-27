export function moduleFactory({
  module,
  imports,
  providers,
  controllers,
}: {
  imports?: any[];
  providers?: any[];
  module?: any;
  controllers?: any[];
}) {
  const common = {
    imports,
    providers,
    exports: [...(imports || []), ...(providers || [])],
  } as any;

  const commonRespectingControllers = controllers?.length
    ? ({
        ...common,
        controllers,
      } as any)
    : common;

  return module
    ? { ...commonRespectingControllers, module }
    : commonRespectingControllers;
}
