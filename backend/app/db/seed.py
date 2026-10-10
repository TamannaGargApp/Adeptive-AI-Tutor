"""Courses (subjects) and their topics. New courses or topics can be added here (or directly in
MongoDB) without code changes elsewhere, because the rest of the app only reads them from the database.

To add a course: add an entry to COURSES with its own list of topics. Topic slugs must be unique
across all courses, so prefix them (e.g. "js-loops").
To add a topic: append it to the end of its course's list (see the note on ordering below)."""

from datetime import UTC, datetime

from app.db.mongodb import get_database

# Each course starts with an introduction topic. It is first in its list and gets order 0, so the
# existing topics keep their order numbers (1, 2, 3, …) in databases created before it was added.
PYTHON_TOPICS: list[dict] = [
    {
        "slug": "python-introduction",
        "name": "Introduction to Python",
        "description": "What Python is, how to run a program, and writing your first lines of code.",
        "key_concepts": ["what Python is", "running a program", "print()", "comments", "indentation and syntax"],
    },
    {
        "slug": "variables-data-types",
        "name": "Variables & Data Types",
        "description": "Store values in variables and work with int, float, str and bool.",
        "key_concepts": ["variable assignment", "int and float", "strings", "booleans", "type()", "type conversion"],
    },
    {
        "slug": "operators",
        "name": "Operators",
        "description": "Arithmetic, comparison, logical and assignment operators.",
        "key_concepts": ["arithmetic operators", "integer division and modulo", "comparison operators", "logical operators", "operator precedence"],
    },
    {
        "slug": "conditional-statements",
        "name": "Conditional Statements",
        "description": "Make decisions with if, elif and else.",
        "key_concepts": ["if statement", "elif chains", "else", "nested conditions", "truthiness"],
    },
    {
        "slug": "loops",
        "name": "Loops",
        "description": "Repeat work with for and while loops.",
        "key_concepts": ["for loop", "range()", "while loop", "break and continue", "nested loops"],
    },
    {
        "slug": "functions",
        "name": "Functions",
        "description": "Write reusable code with def, parameters and return values.",
        "key_concepts": ["defining functions", "parameters and arguments", "return values", "default arguments", "scope"],
    },
    {
        "slug": "lists-tuples",
        "name": "Lists & Tuples",
        "description": "Ordered collections, indexing, slicing and common methods.",
        "key_concepts": ["indexing", "slicing", "list methods", "mutability", "tuples", "iterating over lists"],
    },
    {
        "slug": "dictionaries-sets",
        "name": "Dictionaries & Sets",
        "description": "Key-value pairs and collections of unique items.",
        "key_concepts": ["creating dictionaries", "accessing keys", "dictionary methods", "iterating over dictionaries", "sets", "set operations"],
    },
    {
        "slug": "exception-handling",
        "name": "Exception Handling",
        "description": "Handle errors gracefully with try, except, else and finally.",
        "key_concepts": ["try and except", "specific exception types", "else and finally", "raising exceptions", "common errors"],
    },
    # New topics are appended: existing topics keep their stored order, so inserting one in the
    # middle of this list would give it the same order number as an existing topic.
    {
        "slug": "file-handling",
        "name": "File Handling",
        "description": "Read and write text files safely with open() and the with statement.",
        "key_concepts": ["opening files", "file modes", "reading files", "writing files", "with statement", "handling file errors"],
    },
]


JAVASCRIPT_TOPICS: list[dict] = [
    {
        "slug": "js-introduction",
        "name": "Introduction to JavaScript",
        "description": "What JavaScript is, where it runs, and writing your first lines of code.",
        "key_concepts": ["what JavaScript is", "running JavaScript", "console.log()", "comments", "statements and semicolons"],
    },
    {
        "slug": "js-variables-data-types",
        "name": "Variables & Data Types",
        "description": "Declare variables with let and const and work with numbers, strings and booleans.",
        "key_concepts": ["let and const", "numbers", "strings", "booleans", "typeof", "null and undefined"],
    },
    {
        "slug": "js-operators",
        "name": "Operators",
        "description": "Arithmetic, comparison and logical operators, and how JavaScript converts types.",
        "key_concepts": ["arithmetic operators", "comparison operators", "strict equality", "logical operators", "type coercion"],
    },
    {
        "slug": "js-conditionals",
        "name": "Conditional Statements",
        "description": "Make decisions with if, else, the ternary operator and switch.",
        "key_concepts": ["if and else", "else if", "ternary operator", "switch statement", "truthy and falsy values"],
    },
    {
        "slug": "js-loops",
        "name": "Loops",
        "description": "Repeat work with for, while, for...of and for...in.",
        "key_concepts": ["for loop", "while loop", "for...of", "for...in", "break and continue"],
    },
    {
        "slug": "js-functions",
        "name": "Functions",
        "description": "Function declarations, arrow functions, parameters and return values.",
        "key_concepts": ["function declarations", "arrow functions", "default parameters", "return values", "scope"],
    },
    {
        "slug": "js-arrays",
        "name": "Arrays",
        "description": "Store lists of values and transform them with array methods.",
        "key_concepts": ["indexing", "push and pop", "map and filter", "iterating arrays", "spread syntax"],
    },
    {
        "slug": "js-objects",
        "name": "Objects",
        "description": "Group related data and behaviour with object literals.",
        "key_concepts": ["object literals", "dot and bracket notation", "methods", "iterating objects", "destructuring"],
    },
    {
        "slug": "js-error-handling",
        "name": "Error Handling",
        "description": "Handle errors with try, catch and finally, and throw your own.",
        "key_concepts": ["try and catch", "finally", "throwing errors", "error types", "common errors"],
    },
]

OOP_TOPICS: list[dict] = [
    {
        "slug": "oop-introduction",
        "name": "Introduction to OOP",
        "description": "What object-oriented programming is and why programs are built from objects.",
        "key_concepts": ["objects and classes", "attributes and methods", "procedural vs object-oriented code", "everything in Python is an object"],
    },
    {
        "slug": "oop-classes-objects",
        "name": "Classes & Objects",
        "description": "Define your own classes, create objects from them and give each object its own data.",
        "key_concepts": ["class keyword", "the __init__ method", "self", "instance attributes", "creating instances"],
    },
    {
        "slug": "oop-methods",
        "name": "Methods & Class Attributes",
        "description": "Instance methods, data shared by every object, and class and static methods.",
        "key_concepts": ["instance methods", "class attributes", "@classmethod", "@staticmethod", "instance vs class attributes"],
    },
    {
        "slug": "oop-encapsulation",
        "name": "Encapsulation",
        "description": "Protect an object's data and control how it changes with naming rules and properties.",
        "key_concepts": ["public and protected names", "private names and name mangling", "@property", "property setters", "validating data"],
    },
    {
        "slug": "oop-inheritance",
        "name": "Inheritance",
        "description": "Build new classes from existing ones and reuse or change their behaviour.",
        "key_concepts": ["subclasses", "super()", "method overriding", "multilevel inheritance", "isinstance() and issubclass()"],
    },
    {
        "slug": "oop-polymorphism",
        "name": "Polymorphism & Abstraction",
        "description": "Use different objects through one shared interface, and define interfaces with abstract classes.",
        "key_concepts": ["polymorphism", "duck typing", "abstract base classes", "@abstractmethod", "common interfaces"],
    },
    {
        "slug": "oop-special-methods",
        "name": "Special (Dunder) Methods",
        "description": "Make your objects print nicely, compare and work with Python's operators and built-ins.",
        "key_concepts": ["__str__ and __repr__", "__eq__ and comparisons", "operator overloading", "__len__ and __getitem__", "__iter__"],
    },
    {
        "slug": "oop-composition",
        "name": "Composition & Dataclasses",
        "description": "Combine objects to build larger ones, and write simple data classes with less code.",
        "key_concepts": ["composition (has-a)", "inheritance vs composition", "@dataclass", "default and field values", "custom exception classes"],
    },
]


PANDAS_TOPICS: list[dict] = [
    {
        "slug": "pandas-introduction",
        "name": "Introduction to Pandas",
        "description": "What pandas is, why it's used for data analysis, and its two main structures.",
        "key_concepts": ["what pandas is", "importing pandas as pd", "Series and DataFrame", "tabular data"],
    },
    {
        "slug": "pandas-series",
        "name": "Series",
        "description": "One-dimensional labelled data: create it, index it and calculate with it.",
        "key_concepts": ["creating a Series", "index labels", "vectorised operations", "Series statistics", "value_counts()"],
    },
    {
        "slug": "pandas-dataframes",
        "name": "DataFrames",
        "description": "Create tables of data and inspect their shape, columns and types.",
        "key_concepts": ["creating a DataFrame", "columns and index", "head() and tail()", "shape and dtypes", "describe() and info()"],
    },
    {
        "slug": "pandas-selecting-data",
        "name": "Selecting & Filtering Data",
        "description": "Pick out the rows and columns you need with labels, positions and conditions.",
        "key_concepts": ["selecting columns", "loc", "iloc", "boolean filtering", "combining conditions", "isin()"],
    },
    {
        "slug": "pandas-cleaning",
        "name": "Cleaning Data",
        "description": "Fix messy data: missing values, duplicates, wrong types and inconsistent text.",
        "key_concepts": ["missing values", "fillna() and dropna()", "duplicates", "renaming columns", "astype()", "string methods"],
    },
    {
        "slug": "pandas-transforming",
        "name": "Transforming Data",
        "description": "Add calculated columns, apply functions to values and sort the results.",
        "key_concepts": ["adding columns", "apply()", "map()", "sort_values()", "conditional columns"],
    },
    {
        "slug": "pandas-grouping",
        "name": "Grouping & Aggregation",
        "description": "Summarise data by category with groupby, aggregations and pivot tables.",
        "key_concepts": ["groupby()", "aggregation functions", "agg() with several functions", "pivot_table()", "resetting the index"],
    },
    {
        "slug": "pandas-combining",
        "name": "Combining DataFrames",
        "description": "Stack tables together and join related tables on shared columns.",
        "key_concepts": ["concat()", "merge()", "inner and outer joins", "left and right joins", "joining on keys"],
    },
    {
        "slug": "pandas-reading-writing",
        "name": "Reading & Writing Data",
        "description": "Load data from CSV text and save results in common formats.",
        "key_concepts": ["read_csv()", "CSV options", "to_csv()", "to_dict() and to_json()", "choosing columns and types on load"],
    },
]


FLASK_TOPICS: list[dict] = [
    {
        "slug": "flask-introduction",
        "name": "Introduction to Flask",
        "description": "What a web framework does, how requests and responses work, and your first Flask app.",
        "key_concepts": ["what Flask is", "HTTP requests and responses", "creating a Flask app", "a first route", "the test client"],
    },
    {
        "slug": "flask-routing",
        "name": "Routing",
        "description": "Map URLs to Python functions, read values from the URL and allow different HTTP methods.",
        "key_concepts": ["@app.route", "URL variables", "variable converters", "HTTP methods", "url_for()"],
    },
    {
        "slug": "flask-requests-responses",
        "name": "Requests & Responses",
        "description": "Read query strings, form data and JSON, and control status codes and redirects.",
        "key_concepts": ["request.args", "request.form", "request.get_json()", "status codes", "redirect()", "make_response()"],
    },
    {
        "slug": "flask-templates",
        "name": "Templates with Jinja",
        "description": "Build HTML pages from data with variables, loops, conditions and filters.",
        "key_concepts": ["rendering templates", "template variables", "loops and conditions in templates", "filters", "automatic escaping", "template inheritance"],
    },
    {
        "slug": "flask-forms",
        "name": "Forms & Validation",
        "description": "Handle submitted forms, validate the input and show helpful errors.",
        "key_concepts": ["GET and POST forms", "reading form fields", "validating input", "showing errors", "redirect after POST"],
    },
    {
        "slug": "flask-json-apis",
        "name": "Building JSON APIs",
        "description": "Create a small REST API that lists, creates, updates and deletes data.",
        "key_concepts": ["jsonify()", "returning dictionaries", "REST endpoints", "CRUD operations", "API status codes"],
    },
    {
        "slug": "flask-error-handling",
        "name": "Error Handling",
        "description": "Stop a request with an error and return friendly error pages or JSON.",
        "key_concepts": ["abort()", "@app.errorhandler", "404 and 400 errors", "JSON error responses"],
    },
    {
        "slug": "flask-sessions-cookies",
        "name": "Sessions & Cookies",
        "description": "Remember things between requests with cookies and the signed session.",
        "key_concepts": ["setting cookies", "reading cookies", "the session object", "secret_key", "logging a user in and out"],
    },
    {
        "slug": "flask-blueprints",
        "name": "Blueprints & App Structure",
        "description": "Organise a growing app into blueprints, with an application factory and configuration.",
        "key_concepts": ["Blueprint", "register_blueprint()", "URL prefixes", "application factory", "configuration"],
    },
    {
        "slug": "flask-testing",
        "name": "Testing Flask Apps",
        "description": "Check that your routes work with the test client and simple assertions.",
        "key_concepts": ["test_client()", "checking status codes", "checking response data", "testing JSON APIs", "testing forms"],
    },
]


# Extra instructions for the AI on how to write code for a course, so every example and exercise
# can run in the learner's browser. Courses without special needs leave this out.
PANDAS_GUIDELINES = """\
Code runs in the learner's browser, where pandas is available but there are no files or network.
- Start code with `import pandas as pd`.
- Build data inline from dictionaries or lists, or from a CSV string with io.StringIO. Never read files or URLs.
- Show results with print().
- Keep tables tiny (2-4 rows, 2-3 columns). In "predict_output" questions prefer printing single values or lists
  (e.g. `df["price"].sum()` or `df["name"].tolist()`) over whole tables, so the exact output is unambiguous.
- In "write_code" tests, use expressions that print simple values, e.g. `total(df)` or `top_names(df).tolist()`."""

FLASK_GUIDELINES = """\
Code runs in the learner's browser, where Flask is available but there is no web server or network.
- Never call app.run(). Create the app with `app = Flask(__name__)` and send requests with the test client:
  `client = app.test_client()`, then `response = client.get("/hello")` and
  `print(response.status_code, response.get_data(as_text=True))`.
- Use render_template_string() instead of template files, and keep data in Python lists or dictionaries
  (no databases).
- In "write_code" tests, use test-client expressions that print a simple value, e.g.
  `app.test_client().get("/add/2/3").get_data(as_text=True)` or `app.test_client().get("/api/items").get_json()`."""

COURSES: list[dict] = [
    {
        "slug": "python",
        "name": "Python",
        "description": "A beginner-friendly language used for automation, data, and web development.",
        "language": "python",
        "topics": PYTHON_TOPICS,
    },
    {
        "slug": "javascript",
        "name": "JavaScript",
        "description": "The language of the web: make pages interactive and build web apps.",
        "language": "javascript",
        "topics": JAVASCRIPT_TOPICS,
    },
    {
        "slug": "python-oop",
        "name": "Object-Oriented Programming in Python",
        "description": "Model real things in code with classes, objects, inheritance and polymorphism.",
        "language": "python",
        "topics": OOP_TOPICS,
    },
    {
        "slug": "pandas",
        "name": "Data Analysis with Pandas",
        "description": "Load, clean, explore and summarise data with Python's most popular data library.",
        "language": "python",
        "code_guidelines": PANDAS_GUIDELINES,
        "topics": PANDAS_TOPICS,
    },
    {
        "slug": "flask",
        "name": "Web Development with Flask",
        "description": "Build web pages and JSON APIs in Python with the lightweight Flask framework.",
        "language": "python",
        "code_guidelines": FLASK_GUIDELINES,
        "topics": FLASK_TOPICS,
    },
]


async def seed_courses() -> None:
    """Insert missing courses and topics without overwriting ones that were edited in the database."""
    db = get_database()
    now = datetime.now(UTC)
    for course in COURSES:
        existing = await db.subjects.find_one({"slug": course["slug"]})
        # A course an admin deleted stays deleted: it isn't recreated, and neither are its topics.
        if existing and existing.get("deleted"):
            continue
        if existing is None:
            # New courses go after every existing one, including courses added in the admin page.
            last = await db.subjects.find_one(sort=[("order", -1)])
            details = {key: value for key, value in course.items() if key != "topics"}
            await db.subjects.update_one(
                {"slug": course["slug"]},
                {"$setOnInsert": {**details, "order": (last["order"] + 1) if last else 1, "created_at": now}},
                upsert=True,
            )
        elif course.get("code_guidelines") and "code_guidelines" not in existing:
            # Fill in coding guidelines added to a course after it was first created.
            await db.subjects.update_one({"_id": existing["_id"]}, {"$set": {"code_guidelines": course["code_guidelines"]}})
        # Topic order is numbered within each course, starting at 0 for the introduction.
        for order, topic in enumerate(course["topics"]):
            await db.topics.update_one(
                {"slug": topic["slug"]},
                {"$setOnInsert": {**topic, "order": order, "subject": course["slug"], "created_at": now}},
                upsert=True,
            )