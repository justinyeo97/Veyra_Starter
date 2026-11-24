import { useState } from 'react'
import { Pagination, Table } from 'react-bootstrap'
import { paginate, sortItems } from '../utils/calculations'
import { PAGE_SIZE } from '../utils/constants'
import { Icon } from './UI'

const HIDE_CLASSES = {
  sm: 'd-none d-sm-table-cell',
  md: 'd-none d-md-table-cell',
  lg: 'd-none d-lg-table-cell',
  xl: 'd-none d-xl-table-cell',
}

export function TablePagination({ page, pageCount, total, pageSize, onChange, label = 'results' }) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const pages = []
  const start = Math.max(1, Math.min(page - 2, pageCount - 4))
  const end = Math.min(pageCount, start + 4)
  for (let number = start; number <= end; number += 1) pages.push(number)
  return (
    <div className="table-pagination">
      <span className="text-body-secondary small">
        Showing {from}–{to} of {total} {label}
      </span>
      {pageCount > 1 && (
        <Pagination size="sm" className="mb-0">
          <Pagination.Prev disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page" />
          {pages.map((number) => (
            <Pagination.Item key={number} active={number === page} onClick={() => onChange(number)}>
              {number}
            </Pagination.Item>
          ))}
          <Pagination.Next disabled={page === pageCount} onClick={() => onChange(page + 1)} aria-label="Next page" />
        </Pagination>
      )}
    </div>
  )
}

export function DataTable({
  columns,
  rows,
  onRowClick,
  empty,
  pageSize = PAGE_SIZE,
  initialSort,
  label = 'results',
  paginated = true,
  className = '',
}) {
  const [sort, setSort] = useState(initialSort || null)
  const [page, setPage] = useState(1)

  const sortColumn = sort ? columns.find((column) => column.key === sort.key) : null
  const sorted = sortColumn?.sortValue ? sortItems(rows, sortColumn.sortValue, sort.direction) : rows
  const view = paginated ? paginate(sorted, page, pageSize) : { items: sorted, page: 1, pageCount: 1 }

  function toggleSort(column) {
    if (!column.sortValue) return
    setSort((current) => {
      if (current?.key === column.key) {
        return { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key: column.key, direction: column.defaultDirection || 'asc' }
    })
    setPage(1)
  }

  if (rows.length === 0) {
    return empty || null
  }

  return (
    <div className={className}>
      <div className="table-responsive data-table-wrap">
        <Table hover className="data-table align-middle mb-0">
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key
                const classes = [HIDE_CLASSES[column.hideBelow] || '', column.align === 'end' ? 'text-end' : '', column.headerClassName || '']
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={classes.join(' ')}
                    aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {column.sortValue ? (
                      <button type="button" className="sort-button" onClick={() => toggleSort(column)}>
                        {column.label}
                        <Icon
                          name={active ? (sort.direction === 'asc' ? 'sort-up' : 'sort-down') : 'arrow-down-up'}
                          className={`ms-1 ${active ? '' : 'opacity-50'}`}
                        />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {view.items.map((row) => (
              <tr
                key={row.id}
                className={onRowClick ? 'clickable-row' : ''}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={[HIDE_CLASSES[column.hideBelow] || '', column.align === 'end' ? 'text-end' : '', column.className || ''].join(' ')}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {paginated && (
        <TablePagination
          page={view.page}
          pageCount={view.pageCount}
          total={rows.length}
          pageSize={pageSize}
          onChange={setPage}
          label={label}
        />
      )}
    </div>
  )
}

export function RowActions({ children }) {
  return (
    <div className="row-actions" onClick={(event) => event.stopPropagation()}>
      {children}
    </div>
  )
}
