import { validateCard, type ValidationError } from "@icebox/shared";
import type { Card } from "@icebox/shared";

/**
 * Validates card data and renders results.
 */
export class CardValidator {
  private container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
  }

  validate(card: Partial<Card>): ValidationError[] {
    const errors = validateCard(card);
    this.render(errors);
    return errors;
  }

  private render(errors: ValidationError[]): void {
    if (errors.length === 0) {
      this.container.innerHTML = '<div class="validation-ok">✓ Card is valid</div>';
    } else {
      this.container.innerHTML = errors
        .map(
          (e) => `<div class="validation-error">✗ ${e.field}: ${e.message}</div>`
        )
        .join("");
    }
  }
}
