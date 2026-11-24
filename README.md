# Veyra

Welcome to Veyra, a sneaker resale management platform built with React, Express, and PostgreSQL. Manage your sneaker inventory, track orders, monitor profits, manage customers, and organize listings and tasks.

Some parts of the app are not working correctly and incomplete.

Use the checklists to keep track of where you are. You have 50 minutes to complete all sections. If you get stuck, you can move on. You may solve in any order.

**Go over the 3 sections to help finish it up!**

☐ Create a new Project in your Supabase. Open the SQL Editor and paste veyra.sql\
☐ Create a file backend/.env and inside write

```
DATABASE_URL=postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres
PORT=4000
```

☐ Run the backend in /backend\
☐ Run the frontend in /frontend

## Bug Reports

**Bug 1**

**Description**

The customer dropdown validation is incorrect. It displays an error when a valid customer is selected from the list.

**Steps to reproduce**

1. Go to the Orders page.
2. Click "Create order".
3. Select an existing customer from the Customer dropdown.
4. Fill in the remaining required fields.
5. Click "Create order".

**Expected result**

The selected customer is accepted, and the order is created successfully.

**Actual result**

The form displays "Choose a customer from the list." even though a valid customer has been selected. The order cannot be submitted.

**Bug 2**

**Description**

The API root endpoint returns an incorrect health check URL. It returns `/api/helth` instead of `/api/health`.

**Steps to reproduce**

1. Start the backend API.
2. Open `http://localhost:PORT/` in the browser.
3. Check the JSON response.

**Expected result**

The API returns the correct health check endpoint:

`{ "name": "Veyra API", "health": "/api/health" }`

**Actual result**

The API returns `/api/helth` with a spelling mistake in the health endpoint URL.

**Bug 3**

Bug Title

Incorrect total count displayed in table pagination

**Description**

The table pagination component subtracts 2 from `rows.length` when calculating the total number of results. However, the table still displays and paginates all rows. This causes the displayed result count to be inconsistent with the actual number of rows.

**Steps to Reproduce**

1. Navigate to a page that uses the `DataTable` component.
2. Load a table containing multiple rows.
3. Check the total number of results displayed below the table.
4. Compare it with the actual number of rows.

**Expected Result**

The pagination summary should display the correct total number of rows.

**Actual Result**

The pagination summary displays two fewer results than the actual number of rows because `rows.length - 2` is used to calculate the total.

## Feature Addition

☐ Update the database, backend and frontend to allow staff to record and edit maintenance notes for each sneaker. Each sneaker should have a single maintenance notes field where staff can record information about repairs, cleaning, or other maintenance activities. The notes can be updated at any time.

Requirements

- Add a `maintenance_notes` column to the `sneakers` table. It stores text and defaults to an empty value, so existing sneakers have no maintenance notes.
- The API must save and return the new field as `maintenanceNotes` on every sneaker.
- Add an editable "Maintenance notes" text box to the add and edit sneaker forms.
- Display the maintenance notes on the sneaker details page.
- Allow staff to edit and save the notes at any time.
- If the notes are empty, display "No maintenance notes" on the sneaker details page.

| Case                                      | Expected behavior                                                   |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Add maintenance notes to a sneaker        | The notes are saved in the database                                 |
| Reload the page                           | The previously saved notes are still displayed                      |
| Edit existing maintenance notes           | The updated notes replace the previous notes                        |
| Clear the maintenance notes field         | The notes are removed and "No maintenance notes" is displayed       |
| Open a sneaker with no maintenance notes  | "No maintenance notes" is displayed                                  |

## Deployment

☐ Upload your application on a private GitHub repo\
☐ Deploy the application on Vercel and Railway
