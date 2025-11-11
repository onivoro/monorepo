import { Injectable } from '@nestjs/common';
import { $div, $table, $thead, $tbody, $tr, $th, $td, $p, $em, $h3 } from '@onivoro/server-html';
import { TableInfo, ColumnInfo, PrimaryKeyInfo, ForeignKeyInfo, IndexInfo, TableStructureInfo } from './database-schema.service';

@Injectable()
export class HtmlGeneratorService {

  /**
   * Generate HTML for table list with improved styling
   */
  generateTablesListHtml(tables: TableInfo[]): string {
    if (!tables || tables.length === 0) {
      return $div({
        className: 'empty-state',
        children: [
          $p({ textContent: 'No tables found in the database.' })
        ]
      });
    }

    const tableElements = tables.map(table => {
      const rowCount = (table as any).rowCount ? ` (${(table as any).rowCount.toLocaleString()})` : '';
      return $div({
        className: 'table-item',
        'data-table-name': table.tableName,
        '@click': 'selectTable($el.dataset.tableName)',
        children: [
          $div({
            className: 'table-item-icon',
            textContent: '📋'
          }),
          $div({
            className: 'table-item-name',
            textContent: table.tableName
          }),
          $div({
            className: 'table-item-count',
            'x-show': `'${rowCount}' !== ''`,
            textContent: rowCount.replace(/\s/g, '')
          })
        ]
      });
    });

    return tableElements.join('');
  }

  /**
   * Generate HTML for table data (content only, tabs are in main layout)
   */
  generateTableDataHtml(tableName: string, data: any[]): string {
    if (data.length === 0) {
      return $div({
        className: 'empty-state',
        children: [
          $p({ textContent: `No data found in table "${tableName}"` })
        ]
      });
    }

    const columns = Object.keys(data[0]);
    const tableHtml = this.generateDataTableHtml(columns, data);

    return $div({
      className: 'table-container',
      children: [tableHtml]
    });
  }

  /**
   * Generate HTML for table structure
   */
  generateTableStructureHtml(structure: TableStructureInfo): string {
    const pkSet = new Set(structure.primaryKeys.map(pk => pk.columnName));

    const columnsTable = this.generateColumnsTableHtml(structure.columns, pkSet);
    const primaryKeysSection = this.generatePrimaryKeysSection(structure.primaryKeys);
    const foreignKeysSection = this.generateForeignKeysSection(structure.foreignKeys);
    const indicesSection = this.generateIndicesSection(structure.indices);

    return columnsTable + primaryKeysSection + foreignKeysSection + indicesSection;
  }

  /**
   * Generate HTML for query results
   */
  generateQueryResultsHtml(results: any[]): string {
    if (!Array.isArray(results) || results.length === 0) {
      return $div({
        style: { padding: '2rem', textAlign: 'center', color: '#666' },
        textContent: 'Query executed successfully. No results to display.'
      });
    }

    const columns = Object.keys(results[0]);
    const tableHtml = this.generateDataTableHtml(columns, results);

    return $div({
      className: 'table-container',
      children: [tableHtml]
    });
  }

  /**
   * Generate error HTML
   */
  generateErrorHtml(message: string): string {
    return $div({
      className: 'error',
      textContent: `Error: ${message}`
    });
  }

  // Private helper methods for HTML generation
  private generateTabsHtml(): string {
    return $div({
      className: 'tabs',
      children: [
        $div({
          className: 'tab active',
          'data-tab': 'data',
          '@click': "switchTab('data')",
          textContent: '📊 Data'
        }),
        $div({
          className: 'tab',
          'data-tab': 'structure',
          '@click': "switchTab('structure')",
          textContent: '🏗️ Structure'
        })
      ]
    });
  }

  private generateDataTableHtml(columns: string[], data: any[]): string {
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

    return $table({
      children: [
        $thead({ children: [headerRow] }),
        $tbody({ children: rows })
      ]
    });
  }

  private generateColumnsTableHtml(columns: ColumnInfo[], pkSet: Set<string>): string {
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
            textContent: col.columnName,
            style: pkSet.has(col.columnName) ? { fontWeight: 'bold' } : {}
          }),
          $td({ textContent: col.dataType }),
          $td({ textContent: col.isNullable }),
          $td({
            innerHTML: col.columnDefault || '<em>NULL</em>'
          }),
          $td({
            textContent: pkSet.has(col.columnName) ? 'PK' : '',
            style: pkSet.has(col.columnName) ? { fontWeight: 'bold', color: '#007acc' } : {}
          })
        ]
      })
    );

    return $div({
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
  }

  private generatePrimaryKeysSection(primaryKeys: PrimaryKeyInfo[]): string {
    if (primaryKeys.length === 0) {
      return '';
    }

    const pkHeaderRow = $tr({
      children: [
        $th({ textContent: 'Column Name' })
      ]
    });

    const pkRows = primaryKeys.map(pk =>
      $tr({
        children: [
          $td({ textContent: pk.columnName })
        ]
      })
    );

    return $div({
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

  private generateForeignKeysSection(foreignKeys: ForeignKeyInfo[]): string {
    if (foreignKeys.length === 0) {
      return '';
    }

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
          $td({ textContent: fk.columnName }),
          $td({ textContent: fk.foreignTableName }),
          $td({ textContent: fk.foreignColumnName }),
          $td({ textContent: fk.constraintName })
        ]
      })
    );

    return $div({
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

  private generateIndicesSection(indices: IndexInfo[]): string {
    if (indices.length === 0) {
      return '';
    }

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
          $td({ textContent: idx.indexName }),
          $td({ textContent: idx.columnName }),
          $td({ textContent: idx.isUnique ? 'Yes' : 'No' })
        ]
      })
    );

    return $div({
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
}
