export const selectFactory = ({ getState }: { getState: () => any }) => (selector: (state: any) => any) => {
    return selector(getState());
};