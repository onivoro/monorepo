import { BadRequestException } from '@nestjs/common';
import { readFile } from 'fs/promises';

export async function readFileAsJson(path: string) {
  let contents: string;

  try {
    contents = await readFile(path, { encoding: 'utf-8' });
  } catch (e: any) {
    console.log(e);
    throw new BadRequestException(`Could not read ${path}`);
  }

  try {
    return JSON.parse(contents);
  } catch (e: any) {
    throw new BadRequestException(`Could not parse ${path} as JSON: ${e?.message}`);
  }
}
