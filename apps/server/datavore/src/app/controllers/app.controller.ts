import { Controller, Get, Res } from '@nestjs/common';
import { $html, $head, $title, $meta, $script, $style, $body, $div, $h1, $h3, $textarea, $button, $table, $thead, $tbody, $tr, $th, $td, $p, $em, $h2 } from '@onivoro/server-html';
import { AppServerDatavoreConfig } from '../app-server-datavore-config.class';

@Controller()
export class AppController {

constructor(private config: AppServerDatavoreConfig) {}

  @Get()
  get() {
    return $html({
      lang: 'en',
      children: [
        $head({
          children: [
            $meta({ charset: 'UTF-8' }),
            $meta({ name: 'viewport', content: 'width=device-width, initial-scale=1.0' }),
            $title({ textContent: 'TypeORM Database Client' }),
            $script({ src: 'https://unpkg.com/alpinejs@3.13.5/dist/cdn.min.js', defer: true }),
            $style({
              textContent: `
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; }
                  .container { display: flex; height: 100vh; }
                  .sidebar { width: 300px; background: #fff; border-right: 1px solid #e0e0e0; overflow-y: auto; }
                  .main { flex: 1; display: flex; flex-direction: column; }
                  .header { background: #fff; padding: 1rem; border-bottom: 1px solid #e0e0e0; }
                  .content { flex: 1; padding: 1rem; overflow: auto; }
                  .table-list { padding: 1rem; }
                  .table-item { padding: 0.5rem; cursor: pointer; border-radius: 4px; margin-bottom: 0.25rem; }
                  .table-item:hover { background: #f0f0f0; }
                  .table-item.active { background: #007acc; color: white; }
                  .query-editor { margin-bottom: 1rem; }
                  .query-editor textarea { width: 100%; height: 100px; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; }
                  .btn { padding: 0.5rem 1rem; background: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer; }
                  .btn:hover { background: #005a9e; }
                  .table-container { background: white; border-radius: 4px; overflow: hidden; }
                  table { width: 100%; border-collapse: collapse; }
                  th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #e0e0e0; }
                  th { background: #f8f9fa; font-weight: 600; }
                  .loading { text-align: center; padding: 2rem; color: #666; }
                  .error { background: #fee; color: #c33; padding: 1rem; border-radius: 4px; margin-bottom: 1rem; }
                  .tabs { display: flex; border-bottom: 1px solid #e0e0e0; }
                  .tab { padding: 0.75rem 1rem; cursor: pointer; border-bottom: 2px solid transparent; }
                  .tab.active { border-bottom-color: #007acc; color: #007acc; font-weight: 600; }
                  .tab-content { display: none; }
                  .tab-content.active { display: block; }
                `
            })
          ]
        }),
        $body({
          'x-data': 'dbClient()',
          children: [
            $div({
              className: 'container',
              children: [
                // Sidebar
                $div({
                  className: 'sidebar',
                  children: [
                    $div({
                    className: 'table-list',
                    children: [
                      $h3({
                        textContent: 'Tables',
                        style: { marginBottom: '1rem', color: '#333' }
                      }),
                      $div({
                        'x-init': 'loadTables()',
                        children: [
                          $div({
                            id: 'table-list',
                            'x-html': 'tablesHtml'
                          })
                        ]
                      })
                    ]
                  })
                  ]
                }),
                // Main Content
                $div({
                  className: 'main',
                  children: [
                    $div({
                      className: 'header',
                      children: [
                        $h1({ textContent: `DataVore Database Client`, style: {fontSize: '1.8rem'}}),
                        $h2({ textContent: `${this.config.username}@${this.config.host}:${this.config.port}/${this.config.database}`, style: {fontSize: '1.2rem', opacity: .6}}),
                      ]
                    }),
                    $div({
                      className: 'content',
                      children: [
                        // Query Editor
                        $div({
                          className: 'query-editor',
                          children: [
                            $textarea({
                              'x-model': 'query',
                              placeholder: 'Enter SQL query...'
                            }),
                            $button({
                              className: 'btn',
                              '@click': 'executeQuery()',
                              style: { marginTop: '0.5rem' },
                              textContent: 'Execute Query'
                            })
                          ]
                        }),
                        // Results Area
                        $div({
                          id: 'results-area',
                          'x-html': 'resultsHtml'
                        })
                      ]
                    })
                  ]
                })
              ]
            }),
            $script({
              textContent: `
                  function dbClient() {
                      return {
                          query: '',
                          selectedTable: '',
                          tablesHtml: '<div class="loading">Loading tables...</div>',
                          resultsHtml: '<div class="loading">Select a table or execute a query to see results</div>',
                          loading: false,

                          async loadTables() {
                              try {
                                  this.loading = true;
                                  const response = await fetch('/api/tables');
                                  const html = await response.text();
                                  this.tablesHtml = html;
                              } catch (error) {
                                  this.tablesHtml = '<div class="error">Error loading tables: ' + error.message + '</div>';
                              } finally {
                                  this.loading = false;
                              }
                          },

                          async selectTable(tableName) {
                              this.selectedTable = tableName;

                              // Update table list active state
                              this.$nextTick(() => {
                                  document.querySelectorAll('.table-item').forEach(item => {
                                      item.classList.remove('active');
                                  });
                                  document.querySelector('[data-table="' + tableName + '"]')?.classList.add('active');
                              });

                              // Load table data with tabs
                              try {
                                  this.loading = true;
                                  this.resultsHtml = '<div class="loading">Loading table data...</div>';
                                  const response = await fetch('/api/table/' + tableName);
                                  const html = await response.text();
                                  this.resultsHtml = html;
                              } catch (error) {
                                  this.resultsHtml = '<div class="error">Error loading table data: ' + error.message + '</div>';
                              } finally {
                                  this.loading = false;
                              }
                          },

                          async executeQuery() {
                              if (!this.query.trim()) return;

                              try {
                                  this.loading = true;
                                  this.resultsHtml = '<div class="loading">Executing query...</div>';
                                  const response = await fetch('/api/query', {
                                      method: 'POST',
                                      headers: {
                                          'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({ query: this.query })
                                  });
                                  const html = await response.text();
                                  this.resultsHtml = html;
                              } catch (error) {
                                  this.resultsHtml = '<div class="error">Query error: ' + error.message + '</div>';
                              } finally {
                                  this.loading = false;
                              }
                          },

                          async switchTab(tabName) {
                              // Handle tab switching
                              this.$nextTick(() => {
                                  document.querySelectorAll('.tab').forEach(tab => {
                                      tab.classList.remove('active');
                                  });
                                  document.querySelectorAll('.tab-content').forEach(content => {
                                      content.classList.remove('active');
                                  });

                                  document.querySelector('[data-tab="' + tabName + '"]')?.classList.add('active');
                                  document.getElementById(tabName + '-content')?.classList.add('active');
                              });

                              // Load structure if structure tab is clicked
                              if (tabName === 'structure' && this.selectedTable) {
                                  try {
                                      const response = await fetch('/api/table/' + this.selectedTable + '/structure');
                                      const html = await response.text();
                                      this.$nextTick(() => {
                                          const structureContent = document.getElementById('structure-content');
                                          if (structureContent) {
                                              structureContent.innerHTML = html;
                                          }
                                      });
                                  } catch (error) {
                                      this.$nextTick(() => {
                                          const structureContent = document.getElementById('structure-content');
                                          if (structureContent) {
                                              structureContent.innerHTML = '<div class="error">Error loading structure: ' + error.message + '</div>';
                                          }
                                      });
                                  }
                              }
                          }
                      }
                  }
                `
            })
          ]
        })
      ]
    });
  }
}
