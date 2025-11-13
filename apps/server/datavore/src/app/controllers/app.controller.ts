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
            $link({ rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/editor/editor.main.css' }),
            $style({ textContent: DESIGN_SYSTEM_STYLES }),
            // Load Monaco loader first
            $script({ src: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js' }),
            // Load our client bundle (registers Alpine component)
            $script({ src: '/assets/scripts/db-client.bundle.js' }),
            // Then load Alpine.js (will auto-start after DOM ready)
            $script({ src: 'https://unpkg.com/alpinejs@3.13.5/dist/cdn.min.js', defer: true })
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
                        $div({
                          id: 'editor-container',
                          style: {
                            flex: '1',
                            minHeight: '300px',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden'
                          }
                        })
                      ]
                    }),                        // Results Area
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
        })
      ]
    });
  }
}
