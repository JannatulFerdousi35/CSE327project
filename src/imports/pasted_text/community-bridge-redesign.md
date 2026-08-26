# Improved Figma Make Prompt — Community Action Bridge

Redesign the existing **Community Action Bridge** web application prototype to make it significantly more **user-friendly, simple, accessible, modern, and community-focused**.

The target users are local residents and volunteers, including people from rural districts, upazilas, and villages. Many users may have limited technical experience and may use low-cost smartphones and slower internet connections.

Do NOT make the interface look like a complicated enterprise/admin dashboard. Prioritize simplicity, clear actions, readability, and easy navigation.

## Overall Design Style

Use a clean, friendly, modern community-platform design.

* Primary color: green to represent community, growth, and positive action
* Secondary color: blue for navigation and information
* Use white and very light neutral backgrounds
* Use red only for urgent/dangerous issues
* Use orange/yellow for warnings
* Use green for successful/completed states
* Use a highly readable font such as Inter
* Rounded cards with approximately 12–16px radius
* Soft, subtle shadows
* Generous whitespace
* Clear visual hierarchy
* Large readable text
* Large buttons with clear labels
* Simple line icons
* Friendly community/volunteer illustrations
* Consistent spacing and components across all pages
* Responsive desktop design with mobile-friendly layouts
* Avoid excessive decoration and unnecessary animations

## Important UX Rules

1. Every page should have one clear primary action.
2. Do not overload screens with too many cards, statistics, charts, or controls.
3. Use plain and understandable language instead of technical terms.
4. Buttons should clearly describe what happens when clicked.
5. Use icons together with text, not icons alone for important actions.
6. Keep important information visible without requiring users to search for it.
7. Use confirmation messages after important actions.
8. Use clear status badges such as:

   * New
   * Confirmed
   * Active
   * In Progress
   * Completed
9. Use empty states with helpful explanations.
10. Make forms short and organized into logical sections.
11. Make the design accessible with good contrast and readable font sizes.
12. Keep the interface lightweight and suitable for slower networks.

---

# 1. Login Page

Create a simple and welcoming login page.

Left side:

* Community Action Bridge logo
* Friendly illustration showing residents and volunteers helping a community
* Short message:
  "Together, we can make our communities better."

Right side:

* "Welcome Back"
* Email field
* Password field
* Show/hide password
* Forgot password
* Large "Log In" button
* "Continue with Google" option
* "Don't have an account? Sign Up"

Keep the form clean and uncluttered.

---

# 2. Home Page

Make this the easiest and most important page.

At the top:

"Hello! How can you help your community today?"

Show three large primary action buttons:

* Report an Issue
* Find Volunteer Opportunities
* View Community Events

Then show:

## Nearby Issues

Display 3–4 simple issue cards containing:

* Issue photo
* Issue title
* Category
* Distance/location
* Status
* Number of people who confirmed it
* "View Issue" button

Then:

## Upcoming Events

Show 2–3 event cards with:

* Event name
* Date
* Location
* Volunteers needed
* "Join Event" button

Then show a small map with nearby issue markers.

Do not show too many statistics on the home page. The main purpose of this page is to help users quickly take action.

---

# 3. Report Issue Page

Make reporting an issue extremely simple.

Use a three-step or clearly separated form.

## Step 1 — Describe the Problem

Fields:

* Issue title
* Description
* Category

Category options displayed as large selectable cards:

* Roads
* Garbage
* Flooding
* Clean Water
* School
* Electricity
* Other

## Step 2 — Add Evidence

* Upload photos
* Preview uploaded photos
* Remove photo option

## Step 3 — Location

* Use current location button
* Interactive map
* GPS marker
* Location/address display

At the bottom:

"Submit Issue" primary button.

Show a small note:
"Your location will help nearby community members find and support this issue."

After submission, show a friendly success state:
"Your issue has been reported. Thank you for helping your community!"

---

# 4. Issue Details Page

Create a clear issue information page.

Top:

* Back button
* Issue title
* Category badge
* Status badge

Main section:

* Large issue image
* Description
* Location
* Interactive map
* Reporter information

Show community participation clearly:

"24 people confirmed this issue"

"8 volunteers joined"

Then use three prominent actions:

* Confirm Issue
* Volunteer
* Donate Materials

Show project progress using a simple progress bar.

## AI Action Plan

Create a visually distinct but simple AI section:

"AI Suggested Action Plan"

Show:

1. Recommended first step
2. Required volunteers
3. Required materials
4. Estimated time
5. Suggested next action

Do not make the AI section look complicated.

---

# 5. Volunteer Dashboard

Create a friendly volunteer-focused dashboard.

Top:

"Welcome back, Volunteer!"

Show only useful statistics:

* Projects Joined
* Projects Completed
* Volunteer Hours

Then:

## Nearby Opportunities

Use simple project cards containing:

* Project image
* Title
* Location
* Distance
* Volunteers needed
* Current volunteers
* "View Project"
* "Join Project"

## My Projects

Show project progress with simple progress bars.

Example:

"Clean Village Road"
Progress: 65%
"Continue Project"

---

# 6. Event Dashboard

Create a simple community events page.

Top:

* "Community Events"
* Search events
* Location filter
* Category filter

Show event cards with:

* Event image
* Event title
* Date
* Time
* Location
* Number of participants
* Volunteers needed
* "View Details"
* "Join Event"

Add a simple calendar/filter option but do not make the page complicated.

---

# 7. AI Suggestions Page

Create a friendly AI assistant interface.

Header:

"AI Community Assistant"

Subtitle:

"Get practical suggestions for solving community problems."

Show suggested actions as simple cards:

* Create an action plan
* Estimate required volunteers
* Suggest materials
* Estimate project duration
* Prioritize community issues

Create a conversational AI section:

User:
"How can we solve this flooding problem?"

AI response area:

* Suggested steps
* Required volunteers
* Required materials
* Estimated time
* Safety considerations

Include a clear "Use This Plan" button.

Make the AI useful rather than making it look like a generic chatbot.

---

# 8. Profile Page

Create a simple personal profile.

Top:

* Profile photo
* Name
* District
* Upazila
* Village
* Edit Profile button

Show:

## My Activity

* Issues Reported
* Issues Confirmed
* Projects Joined
* Volunteer Hours

Then:

## My Reports

Display recent reports with status badges.

## Achievements

Use simple achievement badges for:

* First Report
* First Volunteer Activity
* Community Helper
* Completed Project

Keep the page clean.

---

# 9. Admin Dashboard

The admin page can be more information-dense because administrators need more controls.

Use a professional dashboard layout.

Sidebar:

* Dashboard
* Users
* Issues
* Projects
* Volunteers
* Events
* Reports
* Settings

Main dashboard:

Top statistics:

* Total Users
* Reported Issues
* Active Projects
* Completed Projects

Then:

## Pending Issues

Table with:

* Issue
* Location
* Category
* Reported Date
* Status
* Actions

Actions:

* View
* Approve
* Reject

Then:

## Community Activity

Use one or two simple charts:

* Issues by category
* Project completion rate

Do not overload the admin dashboard with unnecessary charts.

---

# Navigation

Use a consistent navigation system throughout the application.

Desktop:

* Logo on the left
* Main navigation
* Notifications
* Profile menu

Navigation items:

Home
Issues
Volunteer
Events
AI Assistant
Profile

For mobile:
Use a simple bottom navigation bar:

Home | Issues | Volunteer | Events | Profile

Keep "Report Issue" as a prominent floating or primary button.

---

# Components to Keep Consistent

Create reusable components for:

* Primary Button
* Secondary Button
* Input Field
* Select Field
* Status Badge
* Issue Card
* Event Card
* Project Card
* Stat Card
* Progress Bar
* Modal
* Notification
* Empty State
* Loading State
* Navigation Bar
* Sidebar

All components should use the same spacing, typography, border radius, and visual style.

---

# User-Friendly States

Design these states as well:

* Loading
* Empty list
* Successful submission
* Error
* No internet connection
* No nearby issues
* No upcoming events
* Issue already confirmed
* Project completed

Use friendly messages.

Example:

"No nearby issues yet. You can be the first person to report a problem in your community."

---

# Final Design Goal

The final prototype should feel like a real, trustworthy community service platform rather than an AI-generated template.

Prioritize:

Simplicity → Clear actions → Easy navigation → Readability → Community participation

The first-time user should immediately understand:

1. What this platform does
2. How to report a problem
3. How to volunteer
4. How to find community events
5. How AI can help solve an issue

Maintain the existing **Community Action Bridge** functionality and page structure, but significantly improve the UX, visual hierarchy, accessibility, and ease of use.
