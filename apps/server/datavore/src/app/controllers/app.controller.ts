import { Controller, Get, Res } from '@nestjs/common';
import { $html, $head, $title, $meta, $script, $style, $body, $div, $h1, $h3, $textarea, $button, $table, $thead, $tbody, $tr, $th, $td, $p, $em, $h2, $input, $header, $aside, $main, $span, $strong, $link } from '@onivoro/server-html';
import { AppServerDatavoreConfig } from '../app-server-datavore-config.class';
import { DESIGN_SYSTEM_STYLES } from '../styles/design-system';

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
            $title({ textContent: 'DataVore Database Client' }),
            $link({ rel: 'icon', type: 'image/x-icon', href: '/assets/images/bear.ico' }),
            $script({ src: 'https://unpkg.com/alpinejs@3.13.5/dist/cdn.min.js', defer: true }),
            $style({ textContent: DESIGN_SYSTEM_STYLES })
          ]
        }),
        $body({
          'x-data': 'dbClient()',
          children: [
            // Header
            $header({
              children: [
                $div({
                  className: 'header-left',
                  children: [
                    $div({
                      className: 'connection-status',
                      children: [
                        $div({
                          className: 'status-indicator',
                          ':class': "{ 'disconnected': !isConnected }",
                        }),
                        $div({
                          className: 'header-info',
                          children: [
                            $h1({
                              textContent: '🗄️ DataVore'
                            }),
                            $p({
                              textContent: `${this.config.username}@${this.config.host}:${this.config.port}/${this.config.database}`
                            })
                          ]
                        })
                      ]
                    })
                  ]
                }),
                $div({
                  className: 'header-right',
                  children: [
                    $div({
                      className: 'stats',
                      children: [
                        $span({
                          children: [
                            $strong({ 'x-text': 'tableCount' }),
                            $span({ textContent: 'Tables' })
                          ]
                        })
                      ]
                    })
                  ]
                })
              ]
            }),

            $div({
              className: 'container',
              style: { flex: '1', display: 'flex' },
              children: [
                // Sidebar
                $aside({
                  'x-init': 'loadTables()',
                  children: [
                    $div({
                      className: 'sidebar-header',
                      children: [
                        $h2({ textContent: '📋 Tables' })
                      ]
                    }),
                    $div({
                      className: 'table-list',
                      'x-html': 'filteredTablesHtml'
                    })
                  ]
                }),

                // Main Content
                $main({
                  children: [
                    $div({
                      className: 'content',
                      children: [
                        // Query Editor
                        $div({
                          className: 'query-editor',
                          children: [
                            $div({
                              className: 'query-editor-header',
                              children: [
                                $h3({ textContent: 'SQL Query' }),
                                $div({
                                  className: 'query-editor-actions',
                                  children: [
                                    $button({
                                      className: 'btn secondary',
                                      '@click': 'clearQuery()',
                                      textContent: 'Clear'
                                    }),
                                    $button({
                                      className: 'btn',
                                      '@click': 'executeQuery()',
                                      textContent: '▶ Execute (CMD + ENTER)'
                                    })
                                  ]
                                })
                              ]
                            }),
                            $textarea({
                              'x-model': 'query',
                              placeholder: 'SELECT * FROM table_name;',
                              '@keydown.ctrl.enter': 'executeQuery()',
                              '@keydown.meta.enter': 'executeQuery()'
                            })
                          ]
                        }),

                        // Results Area
                        $div({
                          className: 'results-area',
                          children: [
                            $div({
                              className: 'tabs',
                              'x-show': 'selectedTable',
                              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
                              children: [
                                $div({
                                  style: { display: 'flex', gap: '0.5rem' },
                                  children: [
                                    $button({
                                      className: 'tab',
                                      ':class': "{ 'active': activeTab === 'data' }",
                                      '@click': "switchTab('data')",
                                      textContent: '📊 Data'
                                    }),
                                    $button({
                                      className: 'tab',
                                      ':class': "{ 'active': activeTab === 'structure' }",
                                      '@click': "switchTab('structure')",
                                      textContent: '🏗️ Structure'
                                    })
                                  ]
                                }),
                                $div({
                                  style: { fontSize: '1.25rem', fontWeight: 'bold', color: '#2c3e50' },
                                  'x-text': 'selectedTable'
                                })
                              ]
                            }),
                            $div({
                              'x-html': 'resultsHtml'
                            })
                          ]
                        })
                      ]
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
                activeTab: 'data',
                isConnected: true,
                tableCount: 0,
                allTables: [],
                filteredTablesHtml: '<div class="loading"><div class="spinner"></div>Loading tables...</div>',
                dataTabContent: '<div class="empty-state"><div class="empty-state-icon">👋</div><p>Select a table or execute a query</p></div>',
                structureTabContent: '',
                structureLoaded: false,

                get resultsHtml() {
                  return this.activeTab === 'data' ? this.dataTabContent : this.structureTabContent;
                },

                async loadTables() {
                  try {
                    this.isConnected = true;
                    const response = await fetch('/api/tables');
                    const html = await response.text();
                    this.allTables = html;
                    this.tableCount = (html.match(/data-table/g) || []).length;
                    this.filteredTablesHtml = this.allTables;
                  } catch (error) {
                    this.isConnected = false;
                    this.filteredTablesHtml = '<div class="error">Error loading tables</div>';
                  }
                },

                async selectTable(tableName) {
                  this.selectedTable = tableName;
                  this.activeTab = 'data';
                  this.structureLoaded = false;
                  this.structureTabContent = '';

                  try {
                    this.dataTabContent = '<div class="loading"><div class="spinner"></div>Loading table data...</div>';
                    const response = await fetch('/api/table/' + tableName);
                    const html = await response.text();
                    this.dataTabContent = html;
                  } catch (error) {
                    this.dataTabContent = '<div class="error">Error loading table data</div>';
                  }
                },

                async executeQuery() {
                  if (!this.query.trim()) return;

                  try {
                    this.dataTabContent = '<div class="loading"><div class="spinner"></div>Executing query...</div>';
                    this.activeTab = 'data';
                    const response = await fetch('/api/query', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ query: this.query })
                    });
                    const html = await response.text();
                    this.dataTabContent = html;
                  } catch (error) {
                    this.dataTabContent = '<div class="error">Query error: ' + error.message + '</div>';
                  }
                },

                switchTab(tabName) {
                  this.activeTab = tabName;
                  if (tabName === 'structure' && this.selectedTable && !this.structureLoaded) {
                    this.loadStructure();
                  }
                },

                async loadStructure() {
                  try {
                    this.structureTabContent = '<div class="loading"><div class="spinner"></div>Loading structure...</div>';
                    const response = await fetch('/api/table/' + this.selectedTable + '/structure');
                    const html = await response.text();
                    this.structureTabContent = html;
                    this.structureLoaded = true;
                  } catch (error) {
                    this.structureTabContent = '<div class="error">Error loading structure</div>';
                  }
                },

                clearQuery() {
                  this.query = '';
                }
              };
            }
          `
        })
      ]
    });
  }
}
