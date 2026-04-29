import { toUniqueArray } from '@onivoro/isomorphic-common';
import { IJsonataExpression } from '../interfaces/jsonata-expression.interface';

export const REG_INTERPOLATION = /{{.+?}}/g;
export const REG_MULTISPACE = /\s{2,}/g;
export const OPENING = '{{';
export const CLOSING = '}}';
export const OPENING_REGEX = /\{\{/g;
export const CLOSING_REGEX = /\}\}/g;

export class JsonataExpressionService {
  normalizeInterpolations(
    content: string,
    valid: any[],
  ): { normalizedInterpolations: string[]; updatedContent: string } {
    let updatedContent = content;
    const map: { original: string; normalized: string }[] = [];
    const normalizedInterpolations: string[] = [];

    valid.forEach((original) => {
      const normalized = this.normalizeInterpolation(original);

      if (original !== normalized) {
        map.push({ original, normalized });
      }

      normalizedInterpolations.push(normalized);
    });

    map.forEach(({ original, normalized }) => {
      updatedContent = updatedContent.replaceAll(original, normalized);
    });

    return { normalizedInterpolations, updatedContent };
  }

  removeBracesFromInterpolations(interpolations: string[]) {
    return interpolations.map(this.removeBracesFromInterpolation);
  }

  addBracesToInterpolations(interpolations: string[]) {
    return interpolations.map(this.addBracesToInterpolation);
  }

  removeBracesFromInterpolation(interpolation: string) {
    return interpolation
      .replace(OPENING_REGEX, '')
      .replace(CLOSING_REGEX, '')
      .trim();
  }

  addBracesToInterpolation(interpolation: string) {
    return `${OPENING}${this.removeBracesFromInterpolation(interpolation)}${CLOSING}`;
  }

  async segregateUniqueInterpolations(
    normalizedInterpolations: string[],
    existingJsonataExpressions: IJsonataExpression[],
  ) {
    const uniqueNormalizedInterpolations = toUniqueArray(normalizedInterpolations);
    const existingInterpolations = this.removeBracesFromInterpolations(existingJsonataExpressions.map(({ expression }) => expression));

    const novelInterpolations = uniqueNormalizedInterpolations.filter((_) => !existingInterpolations.includes(this.removeBracesFromInterpolation(_)));

    return { novelInterpolations, uniqueNormalizedInterpolations };
  }

  private normalizeInterpolation(m: any) {
    const withoutBracesOrSurroundingSpaces = this.removeBracesFromInterpolation(
      m
        .replace(REG_MULTISPACE, ' ')
        .toUpperCase()
    );

    return this.addBracesToInterpolation(withoutBracesOrSurroundingSpaces);
  }

  extractInterpolations(content: string) {
    return content.match(REG_INTERPOLATION);
  }

  validateInterpolations(interpolations: RegExpMatchArray) {
    const valid: any[] = [];
    const invalid: any[] = [];
    interpolations.forEach((m) => {
      if (m.includes('<')) {
        invalid.push(m);
      } else {
        valid.push(m);
      }
    });

    return { valid, invalid };
  }
}
