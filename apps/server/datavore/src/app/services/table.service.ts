import { Injectable } from '@nestjs/common';
import { $div, $table, $thead, $tbody, $tr, $th, $td, $p, $em, $h3 } from '@onivoro/server-html';
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
      // Get column information
      const columns = await dataSource.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      // Get primary key information
      const primaryKeys = await dataSource.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_name = $1
          AND tc.table_schema = 'public'
        ORDER BY kcu.ordinal_position
      `, [tableName]);

      // Get foreign key information
      const foreignKeys = await dataSource.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND tc.table_schema = 'public'
      `, [tableName]);

      // Get index information
      const indices = await dataSource.query(`
        SELECT
          i.relname AS index_name,
          a.attname AS column_name,
          ix.indisunique AS is_unique,
          ix.indisprimary AS is_primary
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relname = $1
          AND t.relkind = 'r'
          AND NOT ix.indisprimary
        ORDER BY i.relname, a.attname
      `, [tableName]);

      const pkSet = new Set(primaryKeys.map(pk => pk.column_name));

      // Columns table
      const columnsHeaderRow = $tr({
        children: [
          $th({ textContent: 'Column' }),
          $th({ textContent: 'Type' }),
          $th({ textContent: 'Nullable' }),
          $th({ textContent: 'Default' }),
          $th({ textContent: 'Key' })
        ]
      });

      const columnsRows = columns.map(col =>
        $tr({
          children: [
            $td({
              textContent: col.column_name,
              style: pkSet.has(col.column_name) ? { fontWeight: 'bold' } : {}
            }),
            $td({ textContent: col.data_type }),
            $td({ textContent: col.is_nullable }),
            $td({
              innerHTML: col.column_default || '<em>NULL</em>'
            }),
            $td({
              textContent: pkSet.has(col.column_name) ? 'PK' : '',
              style: pkSet.has(col.column_name) ? { fontWeight: 'bold', color: '#007acc' } : {}
            })
          ]
        })
      );

      const columnsTable = $div({
        children: [
          $h3({
            textContent: 'Columns',
            style: { marginBottom: '0.5rem', marginTop: '0' }
          }),
          $div({
            className: 'table-container',
            children: [
              $table({
                children: [
                  $thead({ children: [columnsHeaderRow] }),
                  $tbody({ children: columnsRows })
                ]
              })
            ]
          })
        ]
      });

      // Primary Keys section
      let primaryKeysSection = '';
      if (primaryKeys.length > 0) {
        const pkHeaderRow = $tr({
          children: [
            $th({ textContent: 'Column Name' })
          ]
        });

        const pkRows = primaryKeys.map(pk =>
          $tr({
            children: [
              $td({ textContent: pk.column_name })
            ]
          })
        );

        primaryKeysSection = $div({
          style: { marginTop: '1.5rem' },
          children: [
            $h3({
              textContent: 'Primary Keys',
              style: { marginBottom: '0.5rem', marginTop: '0' }
            }),
            $div({
              className: 'table-container',
              children: [
                $table({
                  children: [
                    $thead({ children: [pkHeaderRow] }),
                    $tbody({ children: pkRows })
                  ]
                })
              ]
            })
          ]
        });
      }

      // Foreign Keys section
      let foreignKeysSection = '';
      if (foreignKeys.length > 0) {
        const fkHeaderRow = $tr({
          children: [
            $th({ textContent: 'Column' }),
            $th({ textContent: 'References Table' }),
            $th({ textContent: 'References Column' }),
            $th({ textContent: 'Constraint Name' })
          ]
        });

        const fkRows = foreignKeys.map(fk =>
          $tr({
            children: [
              $td({ textContent: fk.column_name }),
              $td({ textContent: fk.foreign_table_name }),
              $td({ textContent: fk.foreign_column_name }),
              $td({ textContent: fk.constraint_name })
            ]
          })
        );

        foreignKeysSection = $div({
          style: { marginTop: '1.5rem' },
          children: [
            $h3({
              textContent: 'Foreign Keys',
              style: { marginBottom: '0.5rem', marginTop: '0' }
            }),
            $div({
              className: 'table-container',
              children: [
                $table({
                  children: [
                    $thead({ children: [fkHeaderRow] }),
                    $tbody({ children: fkRows })
                  ]
                })
              ]
            })
          ]
        });
      }

      // Indices section
      let indicesSection = '';
      if (indices.length > 0) {
        const indexHeaderRow = $tr({
          children: [
            $th({ textContent: 'Index Name' }),
            $th({ textContent: 'Column' }),
            $th({ textContent: 'Unique' })
          ]
        });

        const indexRows = indices.map(idx =>
          $tr({
            children: [
              $td({ textContent: idx.index_name }),
              $td({ textContent: idx.column_name }),
              $td({ textContent: idx.is_unique ? 'Yes' : 'No' })
            ]
          })
        );

        indicesSection = $div({
          style: { marginTop: '1.5rem' },
          children: [
            $h3({
              textContent: 'Indices',
              style: { marginBottom: '0.5rem', marginTop: '0' }
            }),
            $div({
              className: 'table-container',
              children: [
                $table({
                  children: [
                    $thead({ children: [indexHeaderRow] }),
                    $tbody({ children: indexRows })
                  ]
                })
              ]
            })
          ]
        });
      }

      return columnsTable + primaryKeysSection + foreignKeysSection + indicesSection;
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
