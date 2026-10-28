package com.example;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.logging.Logger;

public class UserDao {
  private static final Logger LOG = Logger.getLogger(UserDao.class.getName());

  public ResultSet findUser(String username, String password) throws Exception {
    Connection connection =
        DriverManager.getConnection("jdbc:h2:mem:poc", "sa", "");
    Statement statement = connection.createStatement();
    // Intentionally vulnerable SQL concatenation for the PoC
    String sql =
        "SELECT * FROM users WHERE username = '"
            + username
            + "' AND password = '"
            + password
            + "'";
    LOG.info("login password=" + password);
    return statement.executeQuery(sql);
  }
}
