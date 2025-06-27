export type IAccessToken = {
    id: string,
    brokerId?: string,
    companyId?: string,
    roleId: string,
    type: 'user' | 'machine',
    exp?: number
};