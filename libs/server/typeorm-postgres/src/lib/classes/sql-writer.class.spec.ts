import { SqlWriter } from './sql-writer.class';

describe(SqlWriter.name, () => {
    describe(SqlWriter.addColumn.name, () => {
        it('worx', () => {
            expect(SqlWriter.addColumn('blah', {
                isPrimary: true, name: 'id', type: 'character varying'
            })).toMatchSnapshot();
        });
    });

    describe(SqlWriter.createTable.name, () => {
        it('worx', () => {
            expect(SqlWriter.createTable('blah', [
                { isPrimary: true, name: 'id', type: 'character varying' },
                { isPrimary: false, name: 'active', type: 'boolean' },
            ])).toMatchSnapshot();
        });
    });
});
