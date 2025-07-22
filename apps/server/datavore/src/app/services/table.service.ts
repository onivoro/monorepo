import { Injectable } from '@nestjs/common';
import { $div, $table, $thead, $tbody, $tr, $th, $td, $p, $em } from '@onivoro/server-html';
import { DataSource } from 'typeorm';

@Injectable()
export class TableService {
  constructor(private readonly dataSource: DataSource) { }

  async getTables(dataSource: DataSource): Promise<string> {
    try {
      const tables = await dataSource.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

      const tableElements = tables.map(table =>
        $div({
          className: 'table-item',
          'data-table': table.table_name,
          '@click': `selectTable('${table.table_name}')`,
          textContent: table.table_name
        })
      );

      return tableElements.join('');
    } catch (error) {
      return $div({
        className: 'error',
        textContent: `Error loading tables: ${error.message}`
      });
    }
  }


  async getTableData(dataSource: DataSource, tableName: string): Promise<string> {
    try {
      const data = await dataSource.query(`SELECT * FROM "${tableName}" LIMIT 100`);

      if (data.length === 0) {
        const tabs = $div({
          className: 'tabs',
          children: [
            $div({
              className: 'tab active',
              'data-tab': 'data',
              '@click': "switchTab('data')",
              textContent: 'Data'
            }),
            $div({
              className: 'tab',
              'data-tab': 'structure',
              '@click': "switchTab('structure')",
              textContent: 'Structure'
            })
          ]
        });

        const dataContent = $div({
          id: 'data-content',
          className: 'tab-content active',
          children: [
            $p({
              style: { padding: '2rem', textAlign: 'center', color: '#666' },
              textContent: `No data found in table "${tableName}"`
            })
          ]
        });

        const structureContent = $div({
          id: 'structure-content',
          className: 'tab-content'
        });

        return tabs + dataContent + structureContent;
      }

      const columns = Object.keys(data[0]);
      const headerRow = $tr({
        children: columns.map(col => $th({ textContent: col }))
      });

      const rows = data.map(row =>
        $tr({
          children: columns.map(col =>
            $td({
              innerHTML: row[col] !== null ? String(row[col]) : '<em>NULL</em>'
            })
          )
        })
      );

      const tabs = $div({
        className: 'tabs',
        children: [
          $div({
            className: 'tab active',
            'data-tab': 'data',
            '@click': "switchTab('data')",
            textContent: 'Data'
          }),
          $div({
            className: 'tab',
            'data-tab': 'structure',
            '@click': "switchTab('structure')",
            textContent: 'Structure'
          })
        ]
      });

      const dataContent = $div({
        id: 'data-content',
        className: 'tab-content active',
        children: [
          $div({
            className: 'table-container',
            children: [
              $table({
                children: [
                  $thead({ children: [headerRow] }),
                  $tbody({ children: rows })
                ]
              })
            ]
          })
        ]
      });

      const structureContent = $div({
        id: 'structure-content',
        className: 'tab-content'
      });

      return tabs + dataContent + structureContent;
    } catch (error) {
      return $div({
        className: 'error',
        textContent: `Error loading table data: ${error.message}`
      });
    }
  }



  async getTableStructure(dataSource: DataSource, tableName: string): Promise<string> {
    try {
      const columns = await dataSource.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

      const headerRow = $tr({
        children: [
          $th({ textContent: 'Column' }),
          $th({ textContent: 'Type' }),
          $th({ textContent: 'Nullable' }),
          $th({ textContent: 'Default' })
        ]
      });

      const rows = columns.map(col =>
        $tr({
          children: [
            $td({ textContent: col.column_name }),
            $td({ textContent: col.data_type }),
            $td({ textContent: col.is_nullable }),
            $td({
              innerHTML: col.column_default || '<em>NULL</em>'
            })
          ]
        })
      );

      return $div({
        className: 'table-container',
        children: [
          $table({
            children: [
              $thead({ children: [headerRow] }),
              $tbody({ children: rows })
            ]
          })
        ]
      });
    } catch (error) {
      return $div({
        className: 'error',
        textContent: `Error loading table structure: ${error.message}`
      });
    }
  }

  async executeQuery(dataSource: DataSource, query: string): Promise<string> {
    try {
      const result = await dataSource.query(query);

      if (!Array.isArray(result) || result.length === 0) {
        return $div({
          style: { padding: '2rem', textAlign: 'center', color: '#666' },
          textContent: 'Query executed successfully. No results to display.'
        });
      }

      const columns = Object.keys(result[0]);
      const headerRow = $tr({
        children: columns.map(col => $th({ textContent: col }))
      });

      const rows = result.map(row =>
        $tr({
          children: columns.map(col =>
            $td({
              innerHTML: row[col] !== null ? String(row[col]) : '<em>NULL</em>'
            })
          )
        })
      );

      return $div({
        className: 'table-container',
        children: [
          $table({
            children: [
              $thead({ children: [headerRow] }),
              $tbody({ children: rows })
            ]
          })
        ]
      });
    } catch (error) {
      return $div({
        className: 'error',
        textContent: `Query error: ${error.message}`
      });
    }
  }
}
