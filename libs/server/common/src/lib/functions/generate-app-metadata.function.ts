export function generateAppMetadata(project: string, appRoot: string) {
  const [platform, app] = project.split('-')
  const assetPath = `${appRoot}/src/assets`;
  const packageJsonPath = `${appRoot}/package.json`;
  const swaggerJsonPath = `api-dox/${project}.json`;

  return { platform, app, assetPath, packageJsonPath, swaggerJsonPath};
}
