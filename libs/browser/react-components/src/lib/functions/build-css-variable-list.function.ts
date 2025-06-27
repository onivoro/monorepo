export const applications = ['surface', 'contrast', 'outline'];
export const variantNames = ['solid', 'outline', 'borderless', 'cta', 'danger', 'positive'];
export const states = ['', 'active', 'disabled', 'hover'];

export function buildClassName({ variant, application, state, component }: { variant: string, application: string, state?: string, component?: string }, includeTailwindPrefixes = false): string {

    if (includeTailwindPrefixes) {
        let prefix: string = '';

        if (state) {
            prefix = `${state}:`;
        }

        prefix = `${prefix}${{ surface: 'bg', contrast: 'text', outline: 'border' }[application]}-`;

        return `${prefix}${buildClassName({ variant, application, component, state }, false)}`;
    } else {
        const base = `${component ? (component + '-') : ''}${variant}-${application}`;

        if (state) {
            return `${base}--${state}`;
        } else {
            return base;
        }
    }
}

export function buildCssVariableListForVariant(component: string, variant: string) {
    const classList: string[] = [];

    applications.forEach(application => {
        states.forEach(state => {
            classList.push(buildClassName({ variant, application, state, component }, true));
        });
    });

    return classList.join(' ');
}

export function buildCssVariableList() {
    const classList: string[] = [];

    variantNames.forEach(variant => {
        applications.forEach(application => {
            states.forEach(state => {
                return buildClassName({ variant, application, state });
            });
        });
    });

    return classList;
}
