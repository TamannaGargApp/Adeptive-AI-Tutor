from tests.conftest import TEST_PASSWORD, register


async def test_register_creates_user_and_logs_in(client):
    response = await register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "ada@example.com"
    assert body["onboarding_completed"] is False
    assert "password_hash" not in body

    me = await client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["name"] == "Ada"


async def test_password_is_hashed_in_database(client, database):
    await register(client)
    stored = await database.users.find_one({"email": "ada@example.com"})
    assert stored["password_hash"] != TEST_PASSWORD
    assert stored["password_hash"].startswith("$argon2")


async def test_register_rejects_duplicate_email(client):
    await register(client)
    response = await register(client, email="ADA@example.com")
    assert response.status_code == 409


async def test_register_rejects_short_password(client):
    response = await client.post(
        "/api/auth/register", json={"name": "Ada", "email": "ada@example.com", "password": "short"}
    )
    assert response.status_code == 422


async def test_login_with_valid_credentials(client):
    await register(client)
    await client.post("/api/auth/logout")

    response = await client.post("/api/auth/login", json={"email": "ada@example.com", "password": TEST_PASSWORD})

    assert response.status_code == 200
    assert "password_hash" not in response.json()
    assert (await client.get("/api/auth/me")).status_code == 200


async def test_login_with_wrong_password_fails(client):
    await register(client)
    await client.post("/api/auth/logout")

    response = await client.post("/api/auth/login", json={"email": "ada@example.com", "password": "wrong-password"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


async def test_login_with_unknown_email_fails(client):
    response = await client.post("/api/auth/login", json={"email": "nobody@example.com", "password": TEST_PASSWORD})
    assert response.status_code == 401


async def test_protected_endpoints_require_authentication(client):
    assert (await client.get("/api/auth/me")).status_code == 401
    assert (await client.get("/api/topics")).status_code == 401
    assert (await client.get("/api/progress")).status_code == 401


async def test_invalid_token_is_rejected(client):
    response = await client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


async def test_logout_ends_the_session(client):
    await register(client)
    await client.post("/api/auth/logout")
    assert (await client.get("/api/auth/me")).status_code == 401
